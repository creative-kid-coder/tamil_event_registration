'use client';

/**
 * Building blocks for the demo. Everything reads one Motion value: the current
 * time in seconds. Continuous movement uses useTransform (no React re-render);
 * discrete changes (text, counts, which screen is showing) use useDerived, which
 * re-renders only when the derived value actually changes. Nothing depends on
 * wall-clock time, so any frame can be rendered exactly by setting the time.
 */
import { cubicBezier, motion, useMotionValueEvent, useTransform, type MotionValue } from 'motion/react';
import { createContext, useContext, useRef, useState } from 'react';

export const TimeContext = createContext<MotionValue<number> | null>(null);
export const AssetsContext = createContext<{ ticketQr: string; posterQr: string }>({ ticketQr: '', posterQr: '' });

export function useTime(): MotionValue<number> {
  const t = useContext(TimeContext);
  if (!t) throw new Error('useTime must be used inside the demo player');
  return t;
}

export const EASE = {
  out: cubicBezier(0.22, 1, 0.36, 1),
  inOut: cubicBezier(0.65, 0, 0.35, 1),
};

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
export const progress = (v: number, a: number, b: number) => clamp01((v - a) / (b - a));

/** React state computed from the time; re-renders only when the result changes. */
export function useDerived<T>(f: (t: number) => T): T {
  const t = useTime();
  const [value, setValue] = useState(() => f(t.get()));
  const current = useRef(value);
  useMotionValueEvent(t, 'change', (v) => {
    const next = f(v);
    if (!Object.is(next, current.current)) {
      current.current = next;
      setValue(next);
    }
  });
  return value;
}

/** True once the time has reached `at`. */
export const usePassed = (at: number) => useDerived((v) => v >= at);

/** A whole number counting from `from` to `to` between times a and b. */
export const useCount = (a: number, b: number, from: number, to: number) =>
  useDerived((v) => Math.round(from + (to - from) * EASE.inOut(progress(v, a, b))));

/** `text` typed out one character at a time from `start`. */
export const useTyped = (start: number, text: string, perChar = 0.07) =>
  useDerived((v) => text.slice(0, Math.max(0, Math.min(text.length, Math.floor((v - start) / perChar)))));

/** A Motion value moving from out[0] to out[1] between times a and b. */
export function useRamp(a: number, b: number, out: [number, number] = [0, 1], ease = EASE.out) {
  return useTransform(useTime(), [a, b], out, { clamp: true, ease });
}

/** Full-stage scene, faded and lifted in at `from` and faded out at `to`. Unmounted outside its window. */
export function Scene({ from, to, children, className = '' }: { from: number; to: number; children: React.ReactNode; className?: string }) {
  const t = useTime();
  const visible = useDerived((v) => v >= from - 0.05 && v <= to + 0.05);
  const opacity = useTransform(t, [from, from + 0.45, to - 0.45, to], [0, 1, 1, 0], { clamp: true });
  const y = useTransform(t, [from, from + 0.7], [28, 0], { clamp: true, ease: EASE.out });
  if (!visible) return null;
  return (
    <motion.div className={`absolute inset-0 ${className}`} style={{ opacity, y }}>
      {children}
    </motion.div>
  );
}

/** Fades (and optionally slides/scales) in at `at`, and out at `leave`. */
export function Appear({
  at,
  leave,
  dur = 0.5,
  x = 0,
  y = 16,
  scale = 1,
  className = '',
  style,
  children,
}: {
  at: number;
  leave?: number;
  dur?: number;
  x?: number;
  y?: number;
  scale?: number;
  className?: string;
  style?: React.ComponentProps<typeof motion.div>['style'];
  children: React.ReactNode;
}) {
  const t = useTime();
  const opacity = useTransform(t, leave ? [at, at + dur, leave, leave + dur] : [at, at + dur], leave ? [0, 1, 1, 0] : [0, 1], {
    clamp: true,
  });
  const tx = useTransform(t, [at, at + dur], [x, 0], { clamp: true, ease: EASE.out });
  const ty = useTransform(t, [at, at + dur], [y, 0], { clamp: true, ease: EASE.out });
  const s = useTransform(t, [at, at + dur], [scale, 1], { clamp: true, ease: EASE.out });
  return (
    <motion.div className={className} style={{ ...style, opacity, x: tx, y: ty, scale: s }}>
      {children}
    </motion.div>
  );
}

/** Shows its children only between `from` and `to` (instant switch, for screens inside a device). */
export function During({ from, to = Infinity, children }: { from: number; to?: number; children: React.ReactNode }) {
  const on = useDerived((v) => v >= from && v < to);
  return on ? <>{children}</> : null;
}

/** A finger tap: a soft dot that presses down at `at`, with a ripple. Position in % of the parent. */
export function Tap({ at, x, y }: { at: number; x: string; y: string }) {
  const t = useTime();
  const opacity = useTransform(t, [at - 0.4, at - 0.15, at + 0.25, at + 0.6], [0, 0.95, 0.95, 0], { clamp: true });
  const scale = useTransform(t, [at - 0.4, at - 0.05, at + 0.12], [1.5, 1, 0.82], { clamp: true, ease: EASE.out });
  const ring = useTransform(t, [at, at + 0.6], [0.6, 2.4], { clamp: true, ease: EASE.out });
  const ringOpacity = useTransform(t, [at - 0.01, at, at + 0.6], [0, 0.8, 0], { clamp: true });
  return (
    <div className="pointer-events-none absolute z-50" style={{ left: x, top: y }}>
      <motion.span className="absolute -top-8 -left-8 h-16 w-16 rounded-full border-4 border-brand" style={{ scale: ring, opacity: ringOpacity }} />
      <motion.span
        className="absolute -top-7 -left-7 h-14 w-14 rounded-full bg-ink/30 shadow-lg ring-4 ring-white/90"
        style={{ opacity, scale }}
      />
    </div>
  );
}

function StatusBar({ light = false }: { light?: boolean }) {
  return (
    <div className={`absolute inset-x-0 top-0 z-40 flex h-11 items-center justify-between px-8 text-[15px] font-semibold ${light ? 'text-white' : 'text-ink'}`}>
      <span>17:42</span>
      <span className="flex items-center gap-1.5">
        <svg viewBox="0 0 18 12" className="h-3 w-[18px]" fill="currentColor" aria-hidden="true">
          <rect x="0" y="8" width="3" height="4" rx="1" />
          <rect x="5" y="5" width="3" height="7" rx="1" />
          <rect x="10" y="2.5" width="3" height="9.5" rx="1" />
          <rect x="15" y="0" width="3" height="12" rx="1" />
        </svg>
        <svg viewBox="0 0 26 12" className="h-3 w-[26px]" fill="none" stroke="currentColor" aria-hidden="true">
          <rect x="0.5" y="0.5" width="22" height="11" rx="3" strokeOpacity="0.5" />
          <rect x="2.5" y="2.5" width="15" height="7" rx="1.5" fill="currentColor" stroke="none" />
          <path d="M24.5 4v4" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.5" />
        </svg>
      </span>
    </div>
  );
}

/** A phone: 372 × 780 screen, with an optional label above it. */
export function Phone({
  children,
  label,
  className = '',
  style,
  lightStatus = false,
}: {
  children: React.ReactNode;
  label?: React.ReactNode;
  className?: string;
  style?: React.ComponentProps<typeof motion.div>['style'];
  lightStatus?: boolean;
}) {
  return (
    // w-max: shrink to the phone, rather than stretching across the stage.
    <motion.div className={`w-max ${className.includes('absolute') ? '' : 'relative'} ${className}`} style={style}>
      {label && <div className="absolute -top-10 inset-x-0 text-center text-lg font-semibold text-muted">{label}</div>}
      <div className="rounded-[56px] bg-[#0d0f15] p-[11px] shadow-[0_40px_90px_-30px_rgba(16,18,27,0.55)] ring-1 ring-black/20">
        <div className="relative h-[780px] w-[372px] overflow-hidden rounded-[46px] bg-bg">
          <div className="absolute top-2.5 left-1/2 z-50 h-[28px] w-[108px] -translate-x-1/2 rounded-full bg-[#0d0f15]" />
          <StatusBar light={lightStatus} />
          <div className="absolute inset-0">{children}</div>
        </div>
      </div>
    </motion.div>
  );
}

/** A laptop: 1000 × 600 screen. */
export function Laptop({ children, className = '', style }: { children: React.ReactNode; className?: string; style?: React.ComponentProps<typeof motion.div>['style'] }) {
  return (
    <motion.div className={className} style={style}>
      <div className="rounded-t-[22px] bg-[#0d0f15] px-3 pt-3 pb-4 shadow-[0_40px_90px_-30px_rgba(16,18,27,0.55)]">
        <div className="relative h-[600px] w-[1000px] overflow-hidden rounded-md bg-bg">{children}</div>
      </div>
      <div className="-mx-10 h-4 rounded-b-2xl bg-gradient-to-b from-[#d4d7df] to-[#9da2b0]" />
      <div className="mx-auto h-1.5 w-44 rounded-b-xl bg-[#8a8f9c]" />
    </motion.div>
  );
}

/** Inline SVG QR code (generated once by the player). */
export function Qr({ svg, className = '' }: { svg: string; className?: string }) {
  return <div className={`[&_svg]:h-auto [&_svg]:w-full ${className}`} dangerouslySetInnerHTML={{ __html: svg }} />;
}
