import Link from "next/link";

/** The DEL infinity mark, redrawn as two strokes: violet (learn) and cyan (ship). */
export const LOOP_LEFT = "M60,30 C48,14 34,8 22,10 C10,12 4,22 4,30 C4,38 10,48 22,50 C34,52 48,46 60,30";
export const LOOP_RIGHT = "M60,30 C72,46 86,52 98,50 C110,48 116,38 116,30 C116,22 110,12 98,10 C86,8 72,14 60,30";
export const LOOP_FULL = `${LOOP_LEFT} ${LOOP_RIGHT.replace(/^M60,30/, "")}`;

export function LoopMark({ className = "h-7 w-14" }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 60" className={className} aria-hidden="true" fill="none">
      <path d={LOOP_LEFT} stroke="var(--violet)" strokeWidth="10" strokeLinecap="round" />
      <path d={LOOP_RIGHT} stroke="var(--cyan)" strokeWidth="10" strokeLinecap="round" />
      <path d="M50,17 L60,30" stroke="var(--violet)" strokeWidth="10" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ href = "/", sub, compact = false }: { href?: string; sub?: string; compact?: boolean }) {
  return (
    <Link href={href} className="group flex items-center gap-2.5 rounded-lg" aria-label="DevOps Easy Learning home">
      <LoopMark className="h-6 w-12 shrink-0" />
      <span className="flex flex-col leading-none">
        <span className={`font-display font-extrabold tracking-[-0.02em] text-ink ${compact ? "whitespace-nowrap text-[0.95rem]" : "max-w-[7.5rem] text-[0.95rem] leading-[1.05] sm:max-w-none sm:whitespace-nowrap sm:text-[1.05rem]"}`}>DevOps Easy Learning</span>
        {sub ? <span className="mt-0.5 text-[0.72rem] font-bold text-muted">{sub}</span> : null}
      </span>
    </Link>
  );
}
