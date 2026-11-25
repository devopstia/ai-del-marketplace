"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X, type LucideIcon } from "lucide-react";
import { Logo } from "../Logo";
import { ThemeToggle } from "../ThemeToggle";
import { useAuth } from "../AuthProvider";
import { Avatar } from "../Avatar";

export type NavItem = { href: string; label: string; icon: LucideIcon; exact?: boolean; badge?: number };

/** Sidebar workspace used by the instructor studio and the admin console. */
export function AppShell({ area, nav, children, footer }: { area: string; nav: NavItem[]; children: React.ReactNode; footer?: React.ReactNode }) {
  const pathname = usePathname();
  const { me } = useAuth();
  const [open, setOpen] = useState(false);
  const isActive = (n: NavItem) => (n.exact ? pathname === n.href : pathname === n.href || pathname.startsWith(`${n.href}/`));
  const links = (
    <ul className="space-y-0.5">
      {nav.map((n) => {
        const a = isActive(n);
        return (
          <li key={n.href}>
            <Link href={n.href} onClick={() => setOpen(false)} aria-current={a ? "page" : undefined}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-[0.93rem] font-bold ${a ? "bg-violet-soft text-violet" : "text-ink-2 hover:bg-surface-2 hover:text-ink"}`}>
              <n.icon className="size-[18px]" aria-hidden="true" />
              <span className="flex-1">{n.label}</span>
              {n.badge ? <span className="rounded-full bg-amber px-1.5 text-xs font-bold leading-5 text-[#1f1500] tabular-nums">{n.badge}</span> : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[264px_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-line bg-surface lg:flex">
        <div className="px-4 py-5"><Logo sub={area} compact /></div>
        <nav aria-label={area} className="flex-1 overflow-y-auto px-3">{links}</nav>
        <div className="border-t border-line p-3">{footer}
          {me ? (
            <div className="flex items-center gap-3 px-2 py-2">
              <Avatar name={me.name} src={me.avatarUrl} size={34} />
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{me.name}</p><p className="truncate text-xs text-muted">{me.email}</p></div>
              <ThemeToggle />
            </div>
          ) : null}
        </div>
      </aside>
      <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-line bg-surface px-3 lg:hidden">
        <button type="button" className="btn btn-ghost btn-sm !px-2" aria-label="Open navigation" onClick={() => setOpen(true)}><Menu className="size-5" /></button>
        <Logo sub={area} compact />
        <span className="ml-auto"><ThemeToggle /></span>
      </header>
      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label={`${area} navigation`}>
          <button type="button" aria-label="Close navigation" className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="pop-in absolute inset-y-0 left-0 w-[min(18rem,85vw)] overflow-y-auto bg-surface p-3 shadow-float">
            <div className="mb-3 flex items-center justify-between px-2 py-2"><Logo sub={area} compact /><button type="button" className="btn btn-ghost btn-sm !px-2" onClick={() => setOpen(false)} aria-label="Close navigation"><X className="size-5" /></button></div>
            {links}
            <div className="mt-4 border-t border-line pt-3">{footer}</div>
          </div>
        </div>
      ) : null}
      <main id="main" className="min-w-0 px-4 py-8 sm:px-8 lg:px-10">{children}</main>
    </div>
  );
}

export function PageHead({ title, sub, actions }: { title: string; sub?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="font-display text-[clamp(1.7rem,3vw,2.3rem)] font-extrabold leading-tight">{title}</h1>
        {sub ? <p className="mt-1 max-w-2xl text-ink-2">{sub}</p> : null}
      </div>
      {actions ? <div className="flex max-w-full min-w-0 flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

/** KPI strip: one bordered band with dividers, not a row of floating cards. */
export function Kpis({ items }: { items: { label: string; value: string; note?: string }[] }) {
  return (
    <dl className="grid grid-cols-2 overflow-hidden rounded-panel border border-line bg-surface md:grid-cols-4">
      {items.map((k, i) => (
        <div key={k.label} className={`p-5 ${i % 2 ? "border-l border-line" : ""} ${i >= 2 ? "border-t border-line md:border-t-0" : ""} ${i === 2 ? "md:border-l" : ""}`}>
          <dt className="text-sm text-muted">{k.label}</dt>
          <dd className="mt-1 font-display text-[1.75rem] font-extrabold leading-none tabular-nums">{k.value}</dd>
          {k.note ? <p className="mt-1.5 text-xs text-muted">{k.note}</p> : null}
        </div>
      ))}
    </dl>
  );
}

export function DataTable({ head, children, min = 640, empty }: { head: string[]; children: React.ReactNode; min?: number; empty?: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-tile border border-line bg-surface">
      <table className="w-full text-left text-sm" style={{ minWidth: min }}>
        <thead className="border-b border-line bg-surface-2/60 text-muted">
          <tr>{head.map((h, i) => <th key={i} className="px-4 py-3 font-bold">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-line">{children}</tbody>
      </table>
      {empty}
    </div>
  );
}
