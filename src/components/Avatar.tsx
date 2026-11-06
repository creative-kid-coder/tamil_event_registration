/** Initials in a softly tinted circle; the hue is derived from the name so it stays stable. */
const HUES = [250, 200, 160, 330, 30, 280, 190, 10];

export function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]!.toUpperCase())
      .join('') || '?';
  let hash = 0;
  for (const c of name) hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
  const hue = HUES[hash % HUES.length];
  const dims = { sm: 'h-7 w-7 text-[11px]', md: 'h-10 w-10 text-sm', lg: 'h-14 w-14 text-lg' }[size];

  return (
    <span
      className={`avatar inline-flex shrink-0 items-center justify-center rounded-full font-semibold ${dims}`}
      style={{ '--hue': hue } as React.CSSProperties}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}
