"use client";
import { useState } from "react";

/** Single-series bar chart (one hue, so no legend). Hover/focus a bar for its value. */
export function BarChart({ data, format, label }: { data: { key: string; label: string; value: number }[]; format: (v: number) => string; label: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.value));
  const W = 560, H = 170, pad = 34, gap = 2;
  const bw = (W - pad) / Math.max(1, data.length);
  const ticks = [0, 0.5, 1].map((f) => f * max);
  const h = hover !== null ? data[hover] : null;
  return (
    <figure className="relative">
      <svg viewBox={`0 0 ${W} ${H + 22}`} className="w-full" role="img" aria-label={label}>
        {ticks.map((t) => {
          const y = H - (t / max) * (H - 10);
          return <g key={t}><line x1={pad} x2={W} y1={y} y2={y} stroke="var(--line)" strokeWidth="1" /><text x={pad - 6} y={y + 4} textAnchor="end" className="fill-muted" style={{ fontSize: 11 }}>{t ? format(t).replace(/\.00$/, "") : "0"}</text></g>;
        })}
        {data.map((d, i) => {
          const bh = d.value ? Math.max(3, (d.value / max) * (H - 10)) : 0;
          const x = pad + i * bw + gap / 2;
          return (
            <g key={d.key} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(i)} onBlur={() => setHover(null)} tabIndex={0} aria-label={`${d.label}: ${format(d.value)}`}>
              <rect x={pad + i * bw} y={0} width={bw} height={H} fill="transparent" />
              {bh ? <path d={`M${x},${H} V${H - bh + 4} q0,-4 4,-4 h${Math.max(0, bw - gap - 8)} q4,0 4,4 V${H} Z`} fill={hover === i ? "var(--violet-strong)" : "var(--violet)"} opacity={hover === null || hover === i ? 1 : 0.55} /> : null}
              {i % Math.ceil(data.length / 6) === 0 ? <text x={x + (bw - gap) / 2} y={H + 16} textAnchor="middle" className="fill-muted" style={{ fontSize: 11 }}>{d.label}</text> : null}
            </g>
          );
        })}
      </svg>
      {h ? (
        <div className="pointer-events-none absolute top-0 rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-float" style={{ left: `clamp(0px, calc(${((pad + (hover! + 0.5) * bw) / W) * 100}% - 60px), calc(100% - 130px))` }}>
          <p className="text-muted">{h.label}</p>
          <p className="font-display text-base font-bold text-ink tabular-nums">{format(h.value)}</p>
        </div>
      ) : null}
    </figure>
  );
}
