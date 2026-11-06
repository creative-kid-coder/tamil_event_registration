'use client';

import { animate, motion, useMotionValue, useTransform, type AnimationPlaybackControls } from 'motion/react';
import QRCode from 'qrcode';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BrandMark, ChevronRightIcon, PauseIcon } from '@/components/icons';
import { EventName } from '@/components/EventName';
import { Appear, AssetsContext, TimeContext, useDerived, useTime } from './kit';
import { BeforeScene, DashboardScene, DeskScene, IntroScene, OutroScene, ProgrammeScene, type DemoEvent } from './scenes';
import { CAPTIONS, CHAPTERS, chapterEnd, DURATION } from './timeline';

const WIDTH = 1920;
const HEIGHT = 1080;
/** The middle of the video (captions, devices, chapter bar), between the intro and the summary. */
const BODY = { from: 5, to: 82 };

declare global {
  interface Window {
    __demo?: {
      ready: boolean;
      duration: number;
      chapters: { title: string; start: number; end: number }[];
      seek: (seconds: number) => Promise<void>;
    };
  }
}

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

/**
 * Plays the demo. Live (`/demo`): autoplays and loops, with Back / Play-Pause /
 * Next and clickable chapters. Render mode (`/demo?render=1`): no controls and
 * no CSS animations; the render script seeks to each frame via window.__demo.
 */
export function DemoPlayer({ event, render }: { event: DemoEvent; render: boolean }) {
  const t = useMotionValue(0);
  const controls = useRef<AnimationPlaybackControls | null>(null);
  const [playing, setPlaying] = useState(!render);
  const [assets, setAssets] = useState({ ticketQr: '', posterQr: '' });
  const [scale, setScale] = useState(1);

  useEffect(() => {
    Promise.all([
      QRCode.toString('K7Q2-M9XD', { type: 'svg', margin: 0, errorCorrectionLevel: 'M' }),
      QRCode.toString('https://example.org/schedule', { type: 'svg', margin: 0, errorCorrectionLevel: 'M' }),
    ]).then(([ticketQr, posterQr]) => setAssets({ ticketQr, posterQr }));
  }, []);

  useEffect(() => {
    const fit = () => setScale(Math.min(window.innerWidth / WIDTH, window.innerHeight / HEIGHT));
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  const play = useCallback(() => {
    controls.current?.stop();
    const from = t.get() >= DURATION - 0.05 ? 0 : t.get();
    t.set(from);
    controls.current = animate(t, DURATION, {
      duration: DURATION - from,
      ease: 'linear',
      onComplete: () => {
        t.set(0);
        play();
      },
    });
    setPlaying(true);
  }, [t]);

  const pause = useCallback(() => {
    controls.current?.stop();
    setPlaying(false);
  }, []);

  const seek = useCallback(
    (seconds: number) => {
      controls.current?.stop();
      t.set(Math.max(0, Math.min(DURATION - 0.01, seconds)));
      if (playing) play();
    },
    [t, playing, play],
  );

  const chapterAt = (v: number) => CHAPTERS.findLastIndex((c) => c.start <= v);

  // Live: start playing; keyboard shortcuts.
  useEffect(() => {
    if (render || !assets.ticketQr) return;
    play();
    return () => controls.current?.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [render, assets.ticketQr]);

  useEffect(() => {
    if (render) return;
    const onKey = (e: KeyboardEvent) => {
      const i = chapterAt(t.get());
      if (e.key === ' ') {
        e.preventDefault();
        if (playing) pause();
        else play();
      } else if (e.key === 'ArrowRight') seek(CHAPTERS[Math.min(i + 1, CHAPTERS.length - 1)].start);
      else if (e.key === 'ArrowLeft') seek(t.get() - CHAPTERS[i].start > 1.5 ? CHAPTERS[i].start : CHAPTERS[Math.max(i - 1, 0)].start);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [render, playing, play, pause, seek, t]);

  // Render mode: let the render script step through frames.
  useEffect(() => {
    if (!render || !assets.ticketQr) return;
    window.__demo = {
      ready: true,
      duration: DURATION,
      chapters: CHAPTERS.map((c, i) => ({ title: c.audience ? `${c.title} (${c.audience})` : c.title, start: c.start, end: chapterEnd(i) })),
      seek: async (seconds) => {
        t.set(seconds);
        // One frame for Motion to write styles, one for React to commit, one to paint.
        await nextFrame();
        await nextFrame();
        await nextFrame();
      },
    };
  }, [render, assets.ticketQr, t]);

  return (
    <TimeContext.Provider value={t}>
      <AssetsContext.Provider value={assets}>
        {render && (
          <style>{`.demo-render *, .demo-render *::before, .demo-render *::after { animation: none !important; transition: none !important; }`}</style>
        )}
        <div className="fixed inset-0 flex items-center justify-center overflow-hidden bg-bg">
          <div
            className={`relative shrink-0 overflow-hidden ${render ? 'demo-render' : ''}`}
            style={{
              width: WIDTH,
              height: HEIGHT,
              transform: `scale(${scale})`,
              background: 'radial-gradient(1400px 600px at 50% -240px, var(--bg-glow), transparent 70%), var(--bg)',
            }}
          >
            <IntroScene event={event} />
            <Body event={event} onSeek={render ? undefined : seek} />
            <OutroScene event={event} />

            {!render && (
              <div className="absolute top-7 right-10 z-50 flex items-center gap-2">
                <ControlButton label="Back" onClick={() => {
                  const i = chapterAt(t.get());
                  seek(t.get() - CHAPTERS[i].start > 1.5 ? CHAPTERS[i].start : CHAPTERS[Math.max(i - 1, 0)].start);
                }}>
                  <ChevronRightIcon className="h-6 w-6 rotate-180" />
                </ControlButton>
                <ControlButton label={playing ? 'Pause' : 'Play'} onClick={() => (playing ? pause() : play())} primary>
                  {playing ? (
                    <PauseIcon className="h-6 w-6" />
                  ) : (
                    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden="true">
                      <path d="M8 5.5v13l11-6.5z" />
                    </svg>
                  )}
                </ControlButton>
                <ControlButton label="Next" onClick={() => seek(CHAPTERS[Math.min(chapterAt(t.get()) + 1, CHAPTERS.length - 1)].start)}>
                  <ChevronRightIcon className="h-6 w-6" />
                </ControlButton>
              </div>
            )}
          </div>
        </div>
      </AssetsContext.Provider>
    </TimeContext.Provider>
  );
}

function ControlButton({ label, onClick, primary = false, children }: { label: string; onClick: () => void; primary?: boolean; children: React.ReactNode }) {
  return (
    <button onClick={onClick} aria-label={label} title={label} className={`btn h-14 w-14 rounded-full p-0 shadow-card ${primary ? 'btn-primary' : 'btn-secondary'}`}>
      {children}
    </button>
  );
}

/** Top bar, captions on the left, the device stage on the right, chapters along the bottom. */
function Body({ event, onSeek }: { event: DemoEvent; onSeek?: (seconds: number) => void }) {
  const t = useTime();
  const visible = useDerived((v) => v >= BODY.from - 0.05 && v <= BODY.to + 0.05);
  const opacity = useTransform(t, [BODY.from - 0.5, BODY.from, BODY.to - 0.4, BODY.to], [0, 1, 1, 0], { clamp: true });
  if (!visible) return null;
  return (
    <motion.div className="absolute inset-0" style={{ opacity }}>
      <div className="absolute top-8 left-24 flex items-center gap-3.5">
        <BrandMark className="h-11 w-11" />
        <div>
          <div className="text-xl leading-tight font-semibold">
            <EventName name={event.name} />
          </div>
          <div className="text-base text-muted">How check-in works</div>
        </div>
      </div>

      <CaptionPanel />

      <div className="absolute top-[110px] left-[700px] h-[850px] w-[1140px]">
        <BeforeScene event={event} />
        <DeskScene event={event} />
        <DashboardScene event={event} />
        <ProgrammeScene event={event} />
      </div>

      <ChapterBar onSeek={onSeek} />
    </motion.div>
  );
}

function CaptionPanel() {
  const index = useDerived((v) => CAPTIONS.findLastIndex((c) => c.start <= v));
  const chapter = useDerived((v) => CHAPTERS.findLastIndex((c) => c.start <= v));
  const caption = CAPTIONS[index];
  const c = CHAPTERS[chapter];
  if (!caption || !c) return null;
  const steps = CAPTIONS.filter((x) => x.start >= c.start && x.start < chapterEnd(chapter));
  const step = steps.indexOf(caption);
  return (
    <div className="absolute top-[110px] left-24 flex h-[850px] w-[540px] flex-col justify-center">
      <Appear key={c.id} at={c.start} y={10}>
        <span className="pill bg-brand-soft px-4 py-1.5 text-base text-brand">For {c.audience.toLowerCase()}</span>
        <div className="mt-4 text-xl font-semibold tracking-wider text-muted uppercase">{c.title}</div>
      </Appear>
      <Appear key={caption.start} at={caption.start} y={18} className="mt-6">
        <h2 className="text-[52px] leading-[1.08] font-semibold tracking-tight">{caption.title}</h2>
        <p className="mt-5 text-[26px] leading-snug text-muted">{caption.text}</p>
      </Appear>
      <div className="mt-10 flex gap-2.5">
        {steps.map((s, i) => (
          <span key={s.start} className={`h-2.5 rounded-full transition-all ${i === step ? 'w-10 bg-brand' : i < step ? 'w-2.5 bg-brand/50' : 'w-2.5 bg-line'}`} />
        ))}
      </div>
    </div>
  );
}

function ChapterBar({ onSeek }: { onSeek?: (seconds: number) => void }) {
  const current = useDerived((v) => CHAPTERS.findLastIndex((c) => c.start <= v));
  return (
    <div className="absolute inset-x-24 bottom-9 flex gap-4">
      {CHAPTERS.map((c, i) =>
        c.audience ? (
          <button
            key={c.id}
            type="button"
            disabled={!onSeek}
            onClick={() => onSeek?.(c.start)}
            className="flex-1 text-left disabled:cursor-default"
          >
            <ChapterFill index={i} />
            <div className={`mt-2.5 text-lg font-semibold ${i === current ? 'text-ink' : 'text-muted'}`}>{c.title}</div>
            <div className="text-sm text-muted">{c.audience}</div>
          </button>
        ) : null,
      )}
    </div>
  );
}

function ChapterFill({ index }: { index: number }) {
  const t = useTime();
  const scaleX = useTransform(t, [CHAPTERS[index].start, chapterEnd(index)], [0, 1], { clamp: true });
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-line">
      <motion.div className="h-full origin-left rounded-full bg-brand" style={{ scaleX }} />
    </div>
  );
}
