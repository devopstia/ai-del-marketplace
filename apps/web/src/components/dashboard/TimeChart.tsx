"use client";
import { useEffect, useMemo, useRef, useState } from "react";

export interface TimePoint { date: string; a: number; b?: number }
interface Bucket { label: string; long: string; a: number; b: number }

const DAY = 86_400_000;
const fmt = (iso: string, o: Intl.DateTimeFormatOptions) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", ...o });

/** Days → days (≤ 45), weeks (≤ 140) or months, so a year never draws 365 thin spikes. */
export function bucketize(points: TimePoint[]): { unit: "day" | "week" | "month"; buckets: Bucket[] } {
  const unit = points.length <= 45 ? "day" : points.length <= 140 ? "week" : "month";
  if (unit === "day") return { unit, buckets: points.map((p) => ({ label: fmt(p.date, { month: "short", day: "numeric" }), long: fmt(p.date, { weekday: "short", month: "short", day: "numeric", year: "numeric" }), a: p.a, b: p.b ?? 0 })) };
  const map = new Map<string, Bucket>();
  for (const p of points) {
    const d = new Date(`${p.date}T00:00:00Z`);
    const key = unit === "month" ? p.date.slice(0, 7) : new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * DAY).toISOString().slice(0, 10);
    const b = map.get(key) ?? { label: unit === "month" ? fmt(`${key}-01`, { month: "short" }) : fmt(key, { month: "short", day: "numeric" }), long: unit === "month" ? fmt(`${key}-01`, { month: "long", year: "numeric" }) : `Week of ${fmt(key, { month: "short", day: "numeric", year: "numeric" })}`, a: 0, b: 0 };
    b.a += p.a; b.b += p.b ?? 0;
    map.set(key, b);
  }
  return { unit, buckets: [...map.values()] };
}

/**
 * Time series (Option A): series A as a filled area, series B as a line on the same scale. Drawn at real pixel size
 * (ResizeObserver), hover or arrow keys show the exact values; the summary is read to screen readers.
 */
export function TimeChart({ points, labelA, labelB, format, height = 260, ariaLabel }: { points: TimePoint[]; labelA: string; labelB?: string; format: (v: number) => string; height?: number; ariaLabel: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  const [h, setH] = useState(height);
  const [i, setI] = useState<number | null>(null);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    // Fill the panel: the chart grows with its container (never shorter than `height`).
    const ro = new ResizeObserver(() => { setW(el.clientWidth); setH(Math.max(height, el.clientHeight)); });
    ro.observe(el);
    return () => ro.disconnect();
  }, [height]);
  const { unit, buckets } = useMemo(() => bucketize(points), [points]);
  const H = h, L = 56, R = 12, T = 12, B = 26;
  const max = Math.max(0, ...buckets.map((b) => Math.max(b.a, b.b)));
  const mag = max > 0 ? Math.pow(10, Math.floor(Math.log10(max))) : 1;
  const top = max > 0 ? Math.ceil(max / mag) * mag : 100; // all zero: a flat line on a small scale (a true zero, not "no data")
  const n = buckets.length;
  const x = (k: number) => (n <= 1 ? L + (w - L - R) / 2 : L + (k * (w - L - R)) / (n - 1));
  const y = (v: number) => T + (H - T - B) * (1 - v / top);
  const path = (k: "a" | "b") => buckets.map((b, j) => `${j ? "L" : "M"}${x(j).toFixed(1)},${y(b[k]).toFixed(1)}`).join("");
  const every = Math.max(1, Math.ceil(n / (w < 520 ? 4 : 8)));
  const totalA = buckets.reduce((s, b) => s + b.a, 0), totalB = buckets.reduce((s, b) => s + b.b, 0);
  const at = i !== null ? buckets[i] : null;
  const pick = (clientX: number) => {
    const r = box.current?.getBoundingClientRect();
    if (!r || n === 0) return;
    setI(Math.max(0, Math.min(n - 1, Math.round(((clientX - r.left - L) / Math.max(1, w - L - R)) * (n - 1)))));
  };
  return (
    <div ref={box} className="relative min-h-0 min-w-0 flex-1" style={{ minHeight: height }} data-testid="time-chart">
      {w > 0 ? (
        <svg width={w} height={H} className="absolute inset-0 block rounded-control outline-none focus-visible:ring-2 focus-visible:ring-violet" role="img" aria-label={`${ariaLabel}: ${labelA} ${format(totalA)}${labelB ? `, ${labelB} ${format(totalB)}` : ""}, by ${unit}.`} tabIndex={0}
          onMouseMove={(e) => pick(e.clientX)} onMouseLeave={() => setI(null)} onBlur={() => setI(null)}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight" || e.key === "ArrowLeft") { e.preventDefault(); setI((v) => Math.max(0, Math.min(n - 1, (v ?? (e.key === "ArrowRight" ? -1 : n)) + (e.key === "ArrowRight" ? 1 : -1)))); }
            if (e.key === "Escape") setI(null);
          }}>
          {[0, 1, 2, 3, 4].map((k) => {
            const v = (top * k) / 4;
            return <g key={k}><line x1={L} x2={w - R} y1={y(v)} y2={y(v)} stroke="var(--line)" /><text x={L - 8} y={y(v) + 4} textAnchor="end" fontSize="11.5" fill="var(--muted)">{format(v).replace(/\.00$/, "")}</text></g>;
          })}
          {buckets.map((b, j) => (j % every === 0 ? <text key={j} x={x(j)} y={H - 7} textAnchor="middle" fontSize="11.5" fill="var(--muted)">{b.label}</text> : null))}
          {n > 1 ? <path d={`${path("a")}L${x(n - 1)},${y(0)}L${x(0)},${y(0)}Z`} fill="var(--violet)" opacity={0.1} /> : null}
          {n > 1 ? <path d={path("a")} fill="none" stroke="var(--violet)" strokeWidth={2.2} strokeLinejoin="round" /> : null}
          {n > 1 && labelB ? <path d={path("b")} fill="none" stroke="var(--cyan)" strokeWidth={2.2} strokeLinejoin="round" /> : null}
          {n === 1 ? <circle cx={x(0)} cy={y(buckets[0]!.a)} r={4} fill="var(--violet)" /> : null}
          {at && i !== null ? <g><line x1={x(i)} x2={x(i)} y1={T} y2={H - B} stroke="var(--muted)" strokeDasharray="3 3" /><circle cx={x(i)} cy={y(at.a)} r={4} fill="var(--violet)" />{labelB ? <circle cx={x(i)} cy={y(at.b)} r={4} fill="var(--cyan)" /> : null}</g> : null}
        </svg>
      ) : null}
      {at && i !== null ? (
        <div className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-control bg-ink px-2.5 py-1.5 text-xs text-paper shadow-float" style={{ left: Math.min(w - 90, Math.max(90, x(i))), top: Math.max(10, y(at.a) - 6) }} role="status">
          <b className="font-display">{at.long}</b><br />{labelA} {format(at.a)}{labelB ? ` · ${labelB} ${format(at.b)}` : ""}
        </div>
      ) : null}
    </div>
  );
}
