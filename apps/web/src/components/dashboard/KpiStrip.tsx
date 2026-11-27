/**
 * The KPI strip (Option A): one joined band of figures with dividers, each with its change against the previous period.
 * No `previous` = no comparison; previous 0 with a current value = "new"; both 0 = "—".
 */
export interface Kpi { label: string; value: string; current?: number; previous?: number; note?: string; /** a fall is good (refunds, fees) */ inverse?: boolean }

export function Change({ current, previous, inverse = false }: { current: number; previous: number; inverse?: boolean }) {
  if (!previous && !current) return <span className="text-xs font-bold text-muted">—</span>;
  if (!previous) return <span className="text-xs font-bold text-cyan-ink">new</span>;
  const p = ((current - previous) / previous) * 100;
  if (Math.abs(p) < 0.5) return <span className="text-xs font-bold text-muted">0%</span>;
  const good = inverse ? p < 0 : p > 0;
  return (
    <span className={`whitespace-nowrap text-xs font-bold ${good ? "text-mint" : "text-rose"}`}>
      <span aria-hidden="true">{p > 0 ? "▲" : "▼"}</span> {Math.abs(p).toFixed(0)}%<span className="sr-only"> {p > 0 ? "up" : "down"} on the previous period</span>
    </span>
  );
}

export function KpiStrip({ items }: { items: Kpi[] }) {
  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-tile border border-line bg-line sm:grid-cols-3 xl:grid-cols-6" data-testid="kpi-strip">
      {items.map((k) => (
        <div key={k.label} className="min-w-0 bg-surface px-4 py-3.5">
          <dt className="truncate text-[0.8rem] text-muted">{k.label}</dt>
          <dd className="mt-0.5 whitespace-nowrap font-display text-[1.45rem] font-extrabold leading-tight tabular-nums">{k.value}</dd>
          <div className="mt-0.5 flex min-h-4 flex-wrap items-baseline gap-x-1.5">
            {k.previous !== undefined && k.current !== undefined ? <Change current={k.current} previous={k.previous} inverse={k.inverse} /> : null}
            {k.note ? <span className="truncate text-xs text-muted">{k.note}</span> : null}
          </div>
        </div>
      ))}
    </dl>
  );
}
