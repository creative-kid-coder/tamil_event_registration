'use client';

import Image from 'next/image';
import QRCode from 'qrcode';
import { useCallback, useEffect, useState } from 'react';
import { Bi } from '@/components/Bi';
import { Diya, plainEventName } from '@/components/EventName';
import { MapPinIcon, MaximizeIcon } from '@/components/icons';
import { PulseDot } from '@/components/ScheduleList';
import type { ShownSponsor } from '@/components/SponsorLightbox';
import { TierBadge } from '@/components/TierBadge';
import { TA } from '@/config/labels';
import { apiCall } from '@/lib/client';
import { groupSchedule, timeRange, type ScheduledItem } from '@/lib/schedule';
import { useLiveRefresh } from '@/lib/useLiveRefresh';

/** How long each sponsor stays up. */
const SLIDE_MS = 8_000;
/** How often the programme is refreshed. */
const POLL_MS = 15_000;

interface Props {
  event: { name: string; date: string; venue: string };
  initialItems: ScheduledItem[];
  /** One full cycle of sponsors, in the order they take turns. */
  slides: ShownSponsor[];
  thanks: string;
}

/**
 * The projector / TV screen, sized to the screen (vw units) so it reads the
 * same from the back of the hall on any projector. Everything updates by
 * itself; the organiser only opens it and presses Full screen.
 */
export function ScreenView({ event, initialItems, slides, thanks }: Props) {
  const [items, setItems] = useState(initialItems);
  const load = useCallback(async () => {
    const { ok, data } = await apiCall<{ items: ScheduledItem[] }>('/api/schedule', { redirectOn401: false });
    if (ok && data.items) setItems(data.items);
  }, []);
  useLiveRefresh(load, POLL_MS);

  const [slide, setSlide] = useState(0);
  useEffect(() => {
    if (slides.length < 2) return;
    const timer = setInterval(() => setSlide((s) => (s + 1) % slides.length), SLIDE_MS);
    return () => clearInterval(timer);
  }, [slides.length]);

  // The time, filled in on the screen itself (the server's clock may differ).
  const [clock, setClock] = useState('');
  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }));
    tick();
    const timer = setInterval(tick, 10_000);
    return () => clearInterval(timer);
  }, []);

  // QR to the guests' programme page at this same address.
  const [qr, setQr] = useState('');
  useEffect(() => {
    QRCode.toString(`${window.location.origin}/schedule`, { type: 'svg', margin: 0, errorCorrectionLevel: 'M' }).then(setQr, () => setQr(''));
  }, []);

  // Full screen button (hidden once full screen), and keep the laptop's screen from dimming.
  const [fullscreen, setFullscreen] = useState(true);
  useEffect(() => {
    const update = () => setFullscreen(Boolean(document.fullscreenElement));
    update();
    document.addEventListener('fullscreenchange', update);

    let lock: { release: () => Promise<void> } | null = null;
    const wake = async () => {
      try {
        const wakeLock = (navigator as Navigator & { wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> } }).wakeLock;
        if (wakeLock && document.visibilityState === 'visible') lock = await wakeLock.request('screen');
      } catch {
        // Not supported or not allowed: the screen may dim, nothing else changes.
      }
    };
    wake();
    document.addEventListener('visibilitychange', wake);
    return () => {
      document.removeEventListener('fullscreenchange', update);
      document.removeEventListener('visibilitychange', wake);
      lock?.release().catch(() => {});
    };
  }, []);

  const { now, next, later } = groupSchedule(items);
  // Still to come, after the current point (not items that were skipped earlier).
  const after = later.filter((item) => item.status === 'upcoming' && (!next[0] || item.start >= next[0].start));
  const started = items.some((item) => item.status === 'starting' || item.status === 'live' || item.status === 'done');
  const finished = started && !now.length && !next.length && !after.length;
  const hero = now.length ? null : next[0];
  const list = now.length ? [...next, ...after] : [...next.slice(1), ...after];

  return (
    <div
      className="screen fixed inset-0 flex flex-col overflow-hidden text-white select-none"
      style={{
        background:
          'radial-gradient(70% 60% at 15% 0%, rgb(236 72 153 / 0.2), transparent 60%), radial-gradient(60% 60% at 100% 100%, rgb(245 158 11 / 0.16), transparent 60%), linear-gradient(160deg, #1d0b33, #120822 55%, #1a0d33)',
      }}
    >
      <header className="flex items-center gap-[1.4vw] px-[3vw] pt-[2.4vh]">
        <Diya className="h-[5vw] w-[5vw] shrink-0" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[2.5vw] leading-tight font-bold">{plainEventName(event.name)}</h1>
          {(event.date || event.venue) && (
            <p className="mt-[0.2vw] truncate text-[1.2vw] text-white/65">{[event.date, event.venue].filter(Boolean).join(' · ')}</p>
          )}
        </div>
        {!fullscreen && (
          <button
            type="button"
            onClick={() => document.documentElement.requestFullscreen?.().catch(() => {})}
            className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold ring-1 ring-white/20 transition hover:bg-white/20"
          >
            <MaximizeIcon className="h-4 w-4" /> Full screen
          </button>
        )}
        <div className="text-[3.4vw] leading-none font-semibold tabular-nums">{clock}</div>
      </header>

      <main className="grid min-h-0 flex-1 grid-cols-12 gap-[2.2vw] px-[3vw] py-[2.6vh]">
        <section className="col-span-7 flex min-h-0 flex-col gap-[2.2vh]">
          {now.length > 0 ? (
            now.slice(0, 2).map((item) => <NowPanel key={item.id} item={item} compact={now.length > 1} />)
          ) : hero ? (
            <NextPanel item={hero} first={!started} />
          ) : (
            <Panel>
              <p className="text-[3.4vw] leading-tight font-bold">{finished ? 'Thank you for coming!' : 'Programme coming soon'}</p>
              {finished && (
                <p lang="ta" className="mt-[0.6vw] text-[2.4vw] font-semibold text-amber-200">
                  {TA.thanksForComing}
                </p>
              )}
            </Panel>
          )}

          {list.length > 0 && (
            <Panel className="min-h-0 flex-1 overflow-hidden">
              <h2 className="text-[1.1vw] font-semibold tracking-[0.12em] text-white/60 uppercase">
                {now.length ? <Bi en="Up next" ta="upNext" /> : <Bi en="Later" ta="later" />}
              </h2>
              <ul className="mt-[0.9vw] space-y-[0.7vw]">
                {list.slice(0, 5).map((item) => (
                  <li key={item.id} className="flex items-baseline gap-[1.4vw]">
                    <span className="w-[5.6vw] shrink-0 text-[1.55vw] font-semibold text-amber-300 tabular-nums">{item.start}</span>
                    <span className={`min-w-0 truncate text-[1.6vw] font-medium ${item.status === 'cancelled' ? 'text-white/40 line-through' : ''}`}>
                      {item.title}
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </section>

        <aside className="col-span-5 flex min-h-0 flex-col">{slides.length > 0 && <SponsorStage slides={slides} index={slide} />}</aside>
      </main>

      <footer className="flex items-center gap-[2vw] px-[3vw] pb-[2.4vh]">
        <p lang="ta" className="min-w-0 flex-1 text-[1.4vw] leading-snug font-bold">
          <span className="thanks-text">{thanks}</span>
        </p>
        {qr && (
          <div className="flex shrink-0 items-center gap-[0.9vw] rounded-[1vw] bg-white/[0.07] py-[0.5vw] pr-[1.2vw] pl-[0.5vw] ring-1 ring-white/10">
            <div className="w-[5.4vw] rounded-[0.5vw] bg-white p-[0.35vw] [&_svg]:h-auto [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: qr }} />
            <div className="text-[1vw] leading-snug">
              <div className="font-semibold">Live programme</div>
              <div lang="ta" className="text-white/70">
                {TA.programme}
              </div>
              <div className="text-white/55">Scan with your phone</div>
            </div>
          </div>
        )}
      </footer>
    </div>
  );
}

function Panel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`relative rounded-[1.4vw] bg-white/[0.07] p-[1.8vw] ring-1 ring-white/12 ${className}`}>{children}</div>;
}

/** Something on right now: big title, place, and the organiser's note. */
function NowPanel({ item, compact }: { item: ScheduledItem; compact: boolean }) {
  const starting = item.status === 'starting';
  return (
    <Panel className="overflow-hidden">
      <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-[0.45vw] ${starting ? 'bg-amber-400' : 'bg-emerald-400'}`} />
      <div className="flex items-center justify-between gap-[1vw]">
        <span
          className={`inline-flex items-center gap-[0.6vw] rounded-full px-[1vw] py-[0.3vw] text-[1.15vw] font-semibold ${starting ? 'bg-amber-400/15 text-amber-300' : 'bg-emerald-400/15 text-emerald-300'}`}
        >
          <PulseDot className={starting ? 'bg-amber-400' : 'bg-emerald-400'} />
          {starting ? <Bi en="Starting now" ta="startingNow" /> : <Bi en="Happening now" ta="happeningNow" />}
        </span>
        <span className="text-[1.35vw] text-white/70 tabular-nums">{timeRange(item)}</span>
      </div>
      <h2 className={`mt-[0.9vw] line-clamp-2 leading-[1.15] font-bold tracking-tight ${compact ? 'text-[2.4vw]' : 'text-[3.3vw]'}`}>{item.title}</h2>
      {item.place && (
        <p className="mt-[0.5vw] flex items-center gap-[0.5vw] text-[1.4vw] text-white/75">
          <MapPinIcon className="h-[1.4vw] w-[1.4vw]" /> {item.place}
        </p>
      )}
      {item.note && <p className="mt-[0.9vw] rounded-[0.8vw] bg-amber-300/15 px-[1vw] py-[0.5vw] text-[1.35vw] font-medium text-amber-200">{item.note}</p>}
    </Panel>
  );
}

/** Nothing on right now: what's next, with its start time large. */
function NextPanel({ item, first }: { item: ScheduledItem; first: boolean }) {
  return (
    <Panel>
      <span className="text-[1.15vw] font-semibold tracking-[0.12em] text-amber-300 uppercase">
        {first ? <Bi en="First up" ta="firstUp" /> : <Bi en="Up next" ta="upNext" />}
      </span>
      <div className="mt-[0.8vw] flex items-baseline gap-[1.6vw]">
        <span className="shrink-0 text-[4vw] leading-none font-bold text-amber-300 tabular-nums">{item.start}</span>
        <h2 className="line-clamp-2 min-w-0 text-[3vw] leading-[1.15] font-bold tracking-tight">{item.title}</h2>
      </div>
      {item.place && (
        <p className="mt-[0.6vw] flex items-center gap-[0.5vw] text-[1.4vw] text-white/75">
          <MapPinIcon className="h-[1.4vw] w-[1.4vw]" /> {item.place}
        </p>
      )}
      {item.note && <p className="mt-[0.9vw] rounded-[0.8vw] bg-amber-300/15 px-[1vw] py-[0.5vw] text-[1.35vw] font-medium text-amber-200">{item.note}</p>}
    </Panel>
  );
}

/** One sponsor at a time, large, with its tier and name; they fade from one to the next. */
function SponsorStage({ slides, index }: { slides: ShownSponsor[]; index: number }) {
  return (
    <Panel className="flex min-h-0 flex-1 flex-col">
      <h2 className="text-center text-[1.1vw] font-semibold tracking-[0.12em] text-white/60 uppercase">
        <Bi en="Our sponsors" ta="ourSponsors" />
      </h2>
      <div className="relative mt-[1vw] min-h-0 flex-1">
        {slides.map((sponsor, i) => (
          <figure
            // The same sponsor appears more than once in a cycle, so the position is the key.
            key={i}
            aria-hidden={i !== index}
            className={`absolute inset-0 flex flex-col items-center transition-opacity duration-700 ${i === index ? 'opacity-100' : 'opacity-0'}`}
          >
            <TierBadge tier={sponsor.tier} size="screen" />
            <div
              className="relative mt-[1vw] min-h-0 w-full flex-1 overflow-hidden rounded-[1.2vw] bg-white"
              style={{ boxShadow: `0 0 0 0.22vw ${sponsor.tier.glow}, 0 1.5vw 4vw -1.5vw ${sponsor.tier.glow}` }}
            >
              <Image
                src={sponsor.src}
                alt={sponsor.name}
                fill
                sizes="40vw"
                unoptimized={sponsor.src.toLowerCase().endsWith('.svg')}
                className="object-contain p-[0.8vw]"
              />
            </div>
            <figcaption className="mt-[0.8vw] text-center text-[1.9vw] leading-tight font-bold">{sponsor.name}</figcaption>
          </figure>
        ))}
      </div>
    </Panel>
  );
}
