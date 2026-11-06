export interface StatTile {
  label: string;
  value: string | number;
  /** Optional total: shows "value / of" and a progress bar. */
  of?: number;
  sub?: string;
  tone?: 'default' | 'warning';
  icon?: React.ReactNode;
}

export function StatsTiles({ tiles }: { tiles: StatTile[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {tiles.map((t) => {
        const pct = t.of ? Math.min(100, Math.round((Number(t.value) / t.of) * 100)) : null;
        const warning = t.tone === 'warning';
        return (
          <div key={t.label} className={`card p-4 sm:p-5 ${warning ? 'border-warning-line bg-warning-soft' : ''}`}>
            <div className={`flex items-center gap-2 text-sm ${warning ? 'text-warning' : 'text-muted'}`}>
              {t.icon}
              <span className="truncate">{t.label}</span>
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-3xl font-semibold tracking-tight tabular-nums">{t.value}</span>
              {t.of !== undefined && <span className="text-sm text-muted tabular-nums">/ {t.of}</span>}
            </div>
            {pct !== null ? (
              <div className="mt-3">
                <div className="h-1.5 overflow-hidden rounded-full bg-line/70">
                  <div className="h-full rounded-full bg-brand transition-all duration-500" style={{ width: `${pct}%` }} />
                </div>
                <div className="mt-1.5 text-xs text-muted tabular-nums">{pct}%</div>
              </div>
            ) : (
              t.sub && <div className={`mt-1 text-xs ${warning ? 'text-warning' : 'text-muted'}`}>{t.sub}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
