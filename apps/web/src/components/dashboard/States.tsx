import Link from "next/link";
import { AlertTriangle, Info } from "lucide-react";

/** Loading: a quiet shimmer shaped like what is coming (never a spinner in the middle of a panel). */
export function PanelSkeleton({ className = "h-40" }: { className?: string }) {
  return <div className={`animate-pulse rounded-tile bg-surface-2 ${className}`} aria-hidden="true" />;
}

/** No data yet: one compact line and an optional next step. Never a big empty box. */
export function EmptyNote({ children, href, action }: { children: React.ReactNode; href?: string; action?: string }) {
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-control border border-dashed border-line-strong px-3 py-2.5 text-sm text-ink-2" data-testid="empty-note">
      <Info className="size-4 shrink-0 text-muted" aria-hidden="true" />
      <span className="min-w-0">{children}</span>
      {href && action ? <Link href={href} className="link ml-auto font-bold">{action}</Link> : null}
    </p>
  );
}

/** The data could not be loaded (different from "zero" and from "no data"): say so and offer a retry. */
export function ErrorNote({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <p role="alert" className="flex flex-wrap items-center gap-2 rounded-control border border-rose/40 bg-rose-soft px-3 py-2.5 text-sm text-ink">
      <AlertTriangle className="size-4 shrink-0 text-rose" aria-hidden="true" />
      <span className="min-w-0">Couldn’t load this: {message}</span>
      {onRetry ? <button type="button" className="link ml-auto font-bold" onClick={onRetry}>Try again</button> : null}
    </p>
  );
}
