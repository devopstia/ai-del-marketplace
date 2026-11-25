import Link from "next/link";
import type { LucideIcon } from "lucide-react";

export function Empty({ icon: Icon, title, body, href, cta }: { icon: LucideIcon; title: string; body: string; href?: string; cta?: string }) {
  return (
    <div className="flex flex-col items-center rounded-panel border border-dashed border-line-strong px-6 py-14 text-center">
      <span className="grid size-14 place-items-center rounded-full bg-violet-soft text-violet"><Icon className="size-6" /></span>
      <h2 className="mt-4 font-display text-xl font-bold">{title}</h2>
      <p className="mt-2 max-w-md text-ink-2">{body}</p>
      {href && cta ? <Link href={href} className="btn btn-primary mt-6">{cta}</Link> : null}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-tile bg-surface-2 ${className}`} />;
}
