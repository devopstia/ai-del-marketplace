import { Star } from "lucide-react";

export function Stars({ value, size = 14, className = "" }: { value: number; size?: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-[1px] ${className}`} aria-label={`Rated ${value.toFixed(1)} out of 5`} role="img">
      {[1, 2, 3, 4, 5].map((i) => {
        const fill = Math.max(0, Math.min(1, value - (i - 1)));
        return (
          <span key={i} className="relative inline-block" style={{ width: size, height: size }}>
            <Star size={size} className="absolute inset-0 text-muted/45" strokeWidth={0} fill="currentColor" />
            <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
              <Star size={size} className="text-star" strokeWidth={0} fill="currentColor" />
            </span>
          </span>
        );
      })}
    </span>
  );
}

export function RatingInline({ avg, count, className = "" }: { avg: number; count: number; className?: string }) {
  if (!count) return <span className={`text-sm font-bold text-cyan-ink ${className}`}>New</span>;
  return (
    <span className={`inline-flex items-center gap-1.5 text-sm ${className}`}>
      <span className="font-bold text-star tabular-nums">{avg.toFixed(1)}</span>
      <Stars value={avg} size={13} />
      <span className="text-muted tabular-nums">({count.toLocaleString("en-US")})</span>
    </span>
  );
}
