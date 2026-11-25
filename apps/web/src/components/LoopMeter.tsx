import { LOOP_FULL } from "./Logo";

/** Progress drawn along the DEL infinity loop — the app's signature progress indicator. */
export function LoopMeter({ value, size = "md", label = true }: { value: number; size?: "sm" | "md" | "lg"; label?: boolean }) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  const dims = size === "sm" ? "h-5 w-10" : size === "lg" ? "h-14 w-28" : "h-8 w-16";
  const done = v >= 100;
  return (
    <span className="inline-flex items-center gap-2" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={v} aria-label={`${v}% complete`}>
      <svg viewBox="0 0 120 60" className={dims} fill="none" aria-hidden="true">
        <path d={LOOP_FULL} stroke="var(--line)" strokeWidth="9" strokeLinecap="round" />
        <path d={LOOP_FULL} pathLength={100} stroke={done ? "var(--mint)" : "url(#lm-grad)"} strokeWidth="9" strokeLinecap="round" strokeDasharray={`${v} 100`} />
        <defs>
          <linearGradient id="lm-grad" x1="0" x2="120" y1="0" y2="0" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="var(--violet)" />
            <stop offset="1" stopColor="var(--cyan)" />
          </linearGradient>
        </defs>
      </svg>
      {label ? <span className={`font-display font-bold tabular-nums ${size === "lg" ? "text-2xl" : "text-sm"} ${done ? "text-mint" : "text-ink"}`}>{v}%</span> : null}
    </span>
  );
}
