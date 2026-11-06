#!/usr/bin/env node
/**
 * Renders the "how it works" demo (/demo) to an MP4, frame by frame.
 *
 *   npm run demo:render                     build, then render demo/how-it-works.mp4
 *   node scripts/render-demo.mjs --stills 12,30.5   save single frames as PNGs instead
 *
 * Options: --url <base> (use a server that's already running with ENABLE_DEMO=1),
 * --port 3100, --out <file.mp4>, --fps 30, --from <s>, --to <s>, --stills <s,s,...>,
 * --keep-frames. Needs Chrome or Edge (or CHROME_PATH) and ffmpeg on the PATH.
 *
 * Every frame is set exactly by seeking the animation's clock, so the video is
 * smooth however long each screenshot takes.
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((pairs, arg, i, all) => {
    if (arg.startsWith('--')) pairs.push([arg.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true]);
    return pairs;
  }, []),
);
const FPS = Number(args.fps ?? 30);
const PORT = Number(args.port ?? 3100);
const OUT = path.resolve(String(args.out ?? 'demo/how-it-works.mp4'));
const WIDTH = 1920;
const HEIGHT = 1080;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const log = (...parts) => console.log('[demo]', ...parts);

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
  ];
  const found = candidates.find((p) => p && existsSync(p));
  if (!found) throw new Error('Chrome or Edge not found. Set CHROME_PATH to the browser executable.');
  return found;
}

async function waitFor(check, what, timeoutMs = 60_000) {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    try {
      const result = await check();
      if (result) return result;
    } catch {}
    await sleep(250);
  }
  throw new Error(`Timed out waiting for ${what}`);
}

const cleanups = [];
async function cleanup() {
  while (cleanups.length) {
    try {
      await cleanups.pop()();
    } catch {}
  }
}
process.on('SIGINT', () => cleanup().then(() => process.exit(130)));

async function main() {
  if (!args.stills && spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' }).status !== 0) {
    throw new Error('ffmpeg not found on the PATH (Windows: winget install --id Gyan.FFmpeg, then open a new terminal).');
  }

  // 1. The app, in demo mode.
  let base = args.url ? String(args.url).replace(/\/+$/, '') : null;
  if (!base) {
    base = `http://localhost:${PORT}`;
    log(`starting the app on port ${PORT}…`);
    const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', String(PORT)], {
      env: { ...process.env, ENABLE_DEMO: '1' },
      stdio: ['ignore', 'ignore', 'inherit'],
    });
    cleanups.push(() => server.kill());
  }
  await waitFor(async () => (await fetch(`${base}/demo?render=1`)).ok, `${base}/demo (is ENABLE_DEMO=1 set, and has \`next build\` run?)`);

  // 2. Headless Chrome at exactly 1920×1080.
  const debugPort = 9300 + Math.floor(Math.random() * 500);
  const profile = mkdtempSync(path.join(tmpdir(), 'demo-chrome-'));
  const chrome = spawn(
    findChrome(),
    ['--headless=new', `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profile}`, '--no-first-run', '--hide-scrollbars', '--force-color-profile=srgb', 'about:blank'],
    { stdio: 'ignore' },
  );
  cleanups.push(async () => {
    chrome.kill();
    await sleep(500);
    rmSync(profile, { recursive: true, force: true });
  });
  const target = await waitFor(async () => (await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json()).find((t) => t.type === 'page'), 'Chrome');
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve) => ws.addEventListener('open', resolve, { once: true }));
  cleanups.push(() => ws.close());
  let id = 0;
  const pending = new Map();
  ws.addEventListener('message', (e) => {
    const msg = JSON.parse(e.data);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
  });
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const n = ++id;
      pending.set(n, (m) => (m.error ? reject(new Error(`${method}: ${m.error.message}`)) : resolve(m.result)));
      ws.send(JSON.stringify({ id: n, method, params }));
    });
  const evaluate = async (expression) => (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result.value;

  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: WIDTH, height: HEIGHT, deviceScaleFactor: 1, mobile: false });
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] });
  await send('Page.navigate', { url: `${base}/demo?render=1` });
  const info = await waitFor(() => evaluate('window.__demo?.ready ? { duration: window.__demo.duration, chapters: window.__demo.chapters } : null'), 'the demo page');
  await evaluate('document.fonts.ready.then(() => true)');

  const shot = async (seconds, format) => {
    await evaluate(`window.__demo.seek(${seconds})`);
    const { data } = await send('Page.captureScreenshot', { format, ...(format === 'jpeg' ? { quality: 92 } : {}) });
    return Buffer.from(data, 'base64');
  };

  // 3a. Single frames, for checking a scene.
  if (args.stills) {
    const dir = path.resolve(String(args['stills-dir'] ?? 'demo/stills'));
    mkdirSync(dir, { recursive: true });
    for (const s of String(args.stills).split(',').map(Number)) {
      const file = path.join(dir, `still-${String(s).replace('.', '_')}.png`);
      writeFileSync(file, await shot(s, 'png'));
      log('saved', file);
    }
    return;
  }

  // 3b. Every frame, then ffmpeg.
  const from = Number(args.from ?? 0);
  const to = Math.min(Number(args.to ?? info.duration), info.duration);
  const first = Math.round(from * FPS);
  const last = Math.round(to * FPS);
  const frames = mkdtempSync(path.join(tmpdir(), 'demo-frames-'));
  if (!args['keep-frames']) cleanups.push(() => rmSync(frames, { recursive: true, force: true }));
  log(`rendering ${last - first} frames (${(to - from).toFixed(1)} s at ${FPS} fps)…`);
  const started = Date.now();
  for (let f = first; f < last; f++) {
    writeFileSync(path.join(frames, `frame-${String(f - first).padStart(6, '0')}.jpg`), await shot(f / FPS, 'jpeg'));
    const done = f - first + 1;
    if (done % (FPS * 5) === 0 || f === last - 1) {
      const perFrame = (Date.now() - started) / done;
      log(`${done}/${last - first} frames · about ${Math.ceil(((last - first - done) * perFrame) / 1000)} s left`);
    }
  }

  // Chapter markers (shown by VLC, QuickTime, YouTube and most desktop players).
  const meta = [';FFMETADATA1', 'title=How check-in works'];
  for (const c of info.chapters) {
    const start = Math.max(c.start, from) - from;
    const end = Math.min(c.end, to) - from;
    if (end > start) meta.push('[CHAPTER]', 'TIMEBASE=1/1000', `START=${Math.round(start * 1000)}`, `END=${Math.round(end * 1000)}`, `title=${c.title}`);
  }
  const metaFile = path.join(frames, 'chapters.txt');
  writeFileSync(metaFile, meta.join('\n') + '\n');

  mkdirSync(path.dirname(OUT), { recursive: true });
  log('encoding with ffmpeg…');
  const ffmpeg = spawnSync(
    'ffmpeg',
    [
      '-y', '-hide_banner', '-loglevel', 'error',
      '-framerate', String(FPS), '-i', path.join(frames, 'frame-%06d.jpg'),
      '-i', metaFile, '-map', '0:v', '-map_metadata', '1', '-map_chapters', '1',
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
      OUT,
    ],
    { stdio: 'inherit' },
  );
  if (ffmpeg.status !== 0) throw new Error('ffmpeg failed');
  log('done:', OUT);
}

main()
  .catch((error) => {
    console.error('[demo]', error.message);
    process.exitCode = 1;
  })
  .finally(cleanup);
