import { CircleCheck, Eye } from "lucide-react";

/**
 * "Reviews you can believe" (owner 2026-11-26): how much of the course the reviewer really watched, measured from the
 * seconds of video they played (replays and skips don't count; the same measure as refunds). Live value from the API.
 */
export function watchedLabel(watchedPercent: number | null | undefined, completed?: boolean): string | null {
  if (completed) return "Completed the course";
  if (watchedPercent == null) return null;
  if (watchedPercent <= 0) return "Hasn't watched the videos yet";
  if (watchedPercent < 1) return "Watched less than 1 % of the course";
  // Floor, so 99.6 % never reads as the whole course.
  return `Watched ${Math.floor(watchedPercent)} % of the course`;
}

export function WatchedBadge({ watchedPercent, completed, className = "" }: { watchedPercent?: number | null; completed?: boolean; className?: string }) {
  const label = watchedLabel(watchedPercent, completed);
  if (!label) return null;
  const Icon = completed ? CircleCheck : Eye;
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-bold ${completed ? "text-mint" : "text-ink-2"} ${className}`}
      title="Measured from the video this learner actually played. Replays don't add to it."
      data-testid="review-watched"
    >
      <Icon className="size-3.5 shrink-0" aria-hidden="true" />{label}
    </span>
  );
}
