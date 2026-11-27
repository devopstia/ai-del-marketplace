import Link from "next/link";

/**
 * Dashboard panel (docs/DASHBOARD_DESIGN.md): one surface with a title row and an optional link on the right.
 * Panels sit in grids whose columns end together; never nest panels inside panels.
 */
export function Panel({ title, href, linkLabel, actions, className = "", children, id }: { title: string; href?: string; linkLabel?: string; actions?: React.ReactNode; className?: string; children: React.ReactNode; id?: string }) {
  return (
    <section className={`flex min-w-0 flex-col rounded-tile border border-line bg-surface p-4 sm:p-5 ${className}`} aria-labelledby={id}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <h2 id={id} className="font-display text-base font-bold">{title}</h2>
        {actions ?? (href ? <Link href={href} className="link text-sm">{linkLabel ?? "View all"}</Link> : null)}
      </div>
      {children}
    </section>
  );
}
