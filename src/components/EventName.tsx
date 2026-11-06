/**
 * The event name, with a leading emoji shown large. A leading 🪔 becomes a
 * drawn Diwali lamp (clay diya, flickering flame, warm glow), which looks the
 * same on every phone, unlike the emoji fonts. Sizes are in em, so it scales
 * with the text it sits in. Works in server and client components.
 */

const LEADING_EMOJI = /^(\p{Extended_Pictographic}(?:️|\p{Emoji_Modifier}|‍\p{Extended_Pictographic})*)\s*/u;

export function Diya({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <defs>
        <radialGradient id="diya-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#fde68a" stopOpacity="0.95" />
          <stop offset="0.45" stopColor="#fbbf24" stopOpacity="0.4" />
          <stop offset="1" stopColor="#f59e0b" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="diya-flame" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff7d6" />
          <stop offset="0.35" stopColor="#fcd34d" />
          <stop offset="0.75" stopColor="#f97316" />
          <stop offset="1" stopColor="#dc2626" />
        </linearGradient>
        <linearGradient id="diya-bowl" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f59e0b" />
          <stop offset="0.45" stopColor="#c2410c" />
          <stop offset="1" stopColor="#7c2d12" />
        </linearGradient>
      </defs>

      {/* Warm glow behind the flame */}
      <circle className="diya-glow" cx="24" cy="17" r="17" fill="url(#diya-glow)" />

      {/* Clay bowl, gold rim, oil, little foot */}
      <path d="M4.5 28.6C6 37 13 41.6 24 41.6S42 37 43.5 28.6C38 31.6 10 31.6 4.5 28.6Z" fill="url(#diya-bowl)" />
      <ellipse cx="24" cy="28.6" rx="19.5" ry="3.2" fill="#fbbf24" />
      <ellipse cx="24" cy="28.7" rx="16.5" ry="2.1" fill="#78350f" />
      <path d="M18.5 41h11l-1.6 3h-7.8z" fill="#7c2d12" />
      {/* Festive dots */}
      <circle cx="14.5" cy="34.6" r="1.25" fill="#fde68a" />
      <circle cx="24" cy="36.6" r="1.35" fill="#fde68a" />
      <circle cx="33.5" cy="34.6" r="1.25" fill="#fde68a" />

      {/* Wick and flame */}
      <path d="M24 24.6v3.4" stroke="#3b1a08" strokeWidth="1.6" strokeLinecap="round" />
      <g className="diya-flame">
        <path d="M24 3.5c4.6 6.2 6.7 10.8 5.1 16.1C28.1 23.1 26.1 25.2 24 25.2s-4.1-2.1-5.1-5.6C17.3 14.3 19.4 9.7 24 3.5Z" fill="url(#diya-flame)" />
        <path d="M24 12c2 3 2.6 5.6 1.8 8.2-.5 1.6-1.2 2.4-1.8 2.4s-1.3-.8-1.8-2.4c-.8-2.6-.2-5.2 1.8-8.2Z" fill="#fffbeb" opacity="0.9" />
      </g>
    </svg>
  );
}

/**
 * `wrap`: a title that may run onto more lines; the lamp starts the first line.
 * Otherwise it stays on one line and is cut off with "…" (headers).
 */
export function EventName({ name, className = '', wrap = false }: { name: string; className?: string; wrap?: boolean }) {
  const match = LEADING_EMOJI.exec(name);
  const text = match ? name.slice(match[0].length) : name;
  const emoji = match?.[1];

  if (wrap) {
    // In the flow of the text, so a long title wraps naturally and stays centred.
    return (
      <span className={className}>
        {emoji === '🪔' ? (
          <Diya className="mr-[0.2em] inline-block h-[1.6em] w-[1.6em] align-[-0.42em]" />
        ) : (
          emoji && <span className="mr-[0.2em] text-[1.3em] leading-none">{emoji}</span>
        )}
        {text}
      </span>
    );
  }

  return (
    <span className={`inline-flex max-w-full items-center gap-[0.3em] align-middle ${className}`}>
      {emoji === '🪔' ? (
        <Diya className="-my-[0.35em] h-[1.75em] w-[1.75em] shrink-0" />
      ) : (
        emoji && <span className="shrink-0 text-[1.4em] leading-none">{emoji}</span>
      )}
      <span className={`min-w-0 ${wrap ? '' : 'truncate'}`}>{text}</span>
    </span>
  );
}
