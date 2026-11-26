import { BadgeCheck } from "lucide-react";
import { OFFICIAL_LABEL } from "@/lib/brand";

/** Shown next to an Official DevOps Easy Learning Instructor (course page, instructor page, admin lists). */
export function OfficialBadge({ className = "", short = false }: { className?: string; short?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full bg-violet-soft px-2.5 py-0.5 text-xs font-bold text-violet ${className}`} data-testid="official-badge">
      <BadgeCheck className="size-3.5 shrink-0" aria-hidden="true" />
      {short ? "Official DEL" : OFFICIAL_LABEL}
    </span>
  );
}
