"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, ChevronDown, ChevronRight, ChevronsLeft, ChevronsRight, Loader2, LogOut, Menu, Store, X } from "lucide-react";
import { LoopMark } from "../Logo";
import { StackTable } from "../StackTable";
import { useOverlay } from "@/lib/useOverlay";
import { ThemeToggle } from "../ThemeToggle";
import { NotificationBell } from "../NotificationBell";
import { useAuth } from "../AuthProvider";
import { Avatar } from "../Avatar";
import { useToast } from "../Toast";
import { api, errMsg } from "@/lib/api";
import { studiosFor, type Studio, type StudioKey } from "@/lib/studios";

import type { NavGroup, NavItem } from "@/lib/studio-nav";
import { SearchButton } from "../search/QuickSearch";
export type { NavGroup, NavItem };

/* ---------- breadcrumbs: pages may name their own last step (a course title, a ticket number) ---------- */
const CrumbCtx = createContext<(label: string | null) => void>(() => {});
/** Name the current page in the breadcrumb trail (e.g. the course being edited). */
export function useCrumb(label: string | null | undefined) {
  const set = useContext(CrumbCtx);
  useEffect(() => { set(label ?? null); return () => set(null); }, [label, set]);
}

const STORE_KEY = "del-sidebar";

/**
 * The one workspace layout for every studio (owner 2026-11-25): Student, Instructor, DEL, Admin / Super Admin.
 * Collapsible sidebar (remembered on this device), studio switcher, "Back to marketplace" always visible,
 * a back button to the parent page, and breadcrumbs. Same structure everywhere; the menu differs by role.
 */
export function AppShell({ studio, nav, children, banner }: { studio: StudioKey; nav: NavGroup[]; children: React.ReactNode; banner?: React.ReactNode }) {
  const pathname = usePathname();
  const { me, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [crumb, setCrumb] = useState<string | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read the remembered choice after mount
    try { if (localStorage.getItem(STORE_KEY) === "collapsed") setCollapsed(true); } catch { /* storage blocked */ }
  }, []);
  const toggle = () => setCollapsed((c) => {
    try { localStorage.setItem(STORE_KEY, c ? "expanded" : "collapsed"); } catch { /* storage blocked */ }
    return !c;
  });
  // eslint-disable-next-line react-hooks/set-state-in-effect -- close the phone drawer after navigating
  useEffect(() => { setOpen(false); }, [pathname]);
  const closeDrawer = useCallback(() => setOpen(false), []);
  useOverlay(open, closeDrawer);

  const studios = studiosFor(me);
  const current = studios.find((s) => s.key === studio) ?? studios[0];
  const items = nav.flatMap((g) => g.items);
  const isActive = (n: NavItem) => (n.exact ? pathname === n.href : pathname === n.href || pathname.startsWith(`${n.href}/`));
  // the most specific match wins (/admin/support vs /admin)
  const active = [...items].sort((a, b) => b.href.length - a.href.length).find(isActive);
  const root = items[0];
  const trail: { label: string; href?: string }[] = [{ label: current?.label ?? "", href: root?.href }];
  if (active && active !== root) trail.push({ label: active.label, href: active.href });
  if (active && pathname !== active.href) trail.push({ label: crumb ?? "Details" });
  const parent = trail.length > 1 ? trail[trail.length - 2] : null;

  const side = (mobile: boolean) => {
    const mini = collapsed && !mobile;
    return (
      <div className="flex h-full flex-col">
        <div className={`flex items-center gap-2 ${mini ? "flex-col px-2 py-4" : "px-4 pb-3 pt-4"}`}>
          <Link href="/" aria-label="DevOps Easy Learning marketplace" className="shrink-0"><LoopMark className={mini ? "h-6 w-12" : "h-7 w-14"} /></Link>
          {mobile ? <button type="button" className="btn btn-ghost btn-sm ml-auto !px-2" onClick={() => setOpen(false)} aria-label="Close navigation"><X className="size-5" /></button> : null}
        </div>
        <div className={mini ? "px-2" : "px-3"}><StudioSwitcher studios={studios} current={current} mini={mini} /></div>
        <div className={`mt-2 ${mini ? "px-2" : "px-3"}`}>
          <Link href="/" title={mini ? "Back to marketplace" : undefined} data-testid="back-to-marketplace"
            className={`flex items-center gap-3 rounded-lg border border-line px-3 py-2 text-[0.9rem] font-bold text-ink-2 hover:border-violet hover:text-ink ${mini ? "justify-center !px-0" : ""}`}>
            <Store className="size-[18px] shrink-0" aria-hidden="true" />{mini ? <span className="sr-only">Back to marketplace</span> : "Back to marketplace"}
          </Link>
        </div>
        <nav aria-label={current?.label ?? "Studio"} className={`mt-3 flex-1 overflow-y-auto pb-4 ${mini ? "px-2" : "px-3"}`}>
          {nav.map((g, gi) => (
            <div key={gi} className={gi ? "mt-4" : ""}>
              {g.label ? (mini ? <div className="mx-2 mb-2 border-t border-line" aria-hidden="true" /> : <p className="px-3 pb-1.5 text-[0.7rem] font-bold uppercase tracking-[0.08em] text-muted">{g.label}</p>) : null}
              <ul className="space-y-0.5">
                {g.items.map((n) => {
                  const a = n === active;
                  return (
                    <li key={n.href}>
                      <Link href={n.href} aria-current={a ? "page" : undefined} title={mini ? n.label : undefined} data-testid={n.testId}
                        className={`relative flex items-center gap-3 rounded-lg py-2 text-[0.92rem] font-bold ${mini ? "justify-center px-0" : "px-3"} ${a ? "bg-violet-soft text-violet" : "text-ink-2 hover:bg-surface-2 hover:text-ink"}`}>
                        <n.icon className="size-[18px] shrink-0" aria-hidden="true" />
                        {mini ? <span className="sr-only">{n.label}</span> : <span className="min-w-0 flex-1 truncate">{n.label}</span>}
                        {n.badge ? (mini
                          ? <span className="absolute right-1 top-1 size-2 rounded-full bg-amber" aria-label={`${n.badge} waiting`} />
                          : <span className="rounded-full bg-amber px-1.5 text-xs font-bold leading-5 text-[var(--on-amber)] tabular-nums">{n.badge}</span>) : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
        <div className={`border-t border-line ${mini ? "px-2 py-3" : "p-3"}`}>
          {me ? (
            <div className={`flex items-center gap-2 ${mini ? "flex-col" : ""}`}>
              <Avatar name={me.name} src={me.avatarUrl} size={32} />
              {!mini ? <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{me.name}</p><p className="truncate text-xs text-muted">{me.email}</p></div> : null}
              <button type="button" className="btn btn-ghost btn-sm !px-2" onClick={() => void logout()} aria-label="Log out" title="Log out"><LogOut className="size-4" /></button>
            </div>
          ) : null}
          {!mobile ? (
            <button type="button" onClick={toggle} aria-expanded={!collapsed} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} data-testid="sidebar-toggle"
              className={`mt-2 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold text-muted hover:bg-surface-2 hover:text-ink ${mini ? "justify-center !px-0" : ""}`}>
              {collapsed ? <ChevronsRight className="size-4" /> : <><ChevronsLeft className="size-4" />Collapse</>}
            </button>
          ) : null}
        </div>
      </div>
    );
  };

  return (
    <CrumbCtx.Provider value={setCrumb}>
      <div className="min-h-dvh lg:grid" data-sidebar={collapsed ? "collapsed" : "expanded"}>
        <aside className={`fixed inset-y-0 left-0 z-30 hidden border-r border-line bg-surface transition-[width] duration-200 lg:block ${collapsed ? "w-[76px]" : "w-[264px]"}`}>{side(false)}</aside>
        <div className={`min-w-0 transition-[padding] duration-200 ${collapsed ? "lg:pl-[76px]" : "lg:pl-[264px]"}`}>
          <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-line bg-[color-mix(in_oklab,var(--paper)_90%,transparent)] px-3 backdrop-blur-md sm:px-6 lg:px-8">
            <button type="button" className="btn btn-ghost btn-sm !px-2 lg:hidden" aria-label="Open navigation" onClick={() => setOpen(true)}><Menu className="size-5" /></button>
            {parent?.href ? (
              <Link href={parent.href} className="btn btn-ghost btn-sm !px-2" aria-label={`Back to ${parent.label}`} title={`Back to ${parent.label}`} data-testid="studio-back"><ArrowLeft className="size-5" /></Link>
            ) : null}
            <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
              <ol className="flex min-w-0 items-center gap-1 text-sm" data-testid="breadcrumbs">
                {trail.map((t, i) => {
                  const last = i === trail.length - 1;
                  return (
                    <li key={i} className={`flex min-w-0 items-center gap-1 ${!last && i === 0 ? "max-sm:hidden" : ""}`}>
                      {i ? <ChevronRight className={`size-3.5 shrink-0 text-muted ${i === 1 ? "max-sm:hidden" : ""}`} aria-hidden="true" /> : null}
                      {last || !t.href ? <span aria-current={last ? "page" : undefined} className="truncate font-bold text-ink">{t.label}</span>
                        : <Link href={t.href} className="truncate text-muted hover:text-ink">{t.label}</Link>}
                    </li>
                  );
                })}
              </ol>
            </nav>
            <SearchButton />
            <Link href="/" className="btn btn-ghost btn-sm max-sm:!px-2" data-testid="topbar-marketplace" aria-label="Back to marketplace"><Store className="size-4" /><span className="max-sm:hidden">Marketplace</span></Link>
            <NotificationBell />
            <ThemeToggle />
          </header>
          {banner}
          <main id="main" className="min-w-0 px-4 pb-14 pt-7 sm:px-6 lg:px-8">{children}</main>
        </div>
        {open ? (
          <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label={`${current?.label ?? "Studio"} navigation`}>
            <button type="button" aria-label="Close navigation" className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
            <div className="pop-in absolute inset-y-0 left-0 w-[min(19rem,86vw)] bg-surface pb-[env(safe-area-inset-bottom)] shadow-float">{side(true)}</div>
          </div>
        ) : null}
      </div>
    </CrumbCtx.Provider>
  );
}

/** Which studio am I in, and where else may I go? DEL Studio is the instructor studio acting as DEL (super admins). */
function StudioSwitcher({ studios, current, mini }: { studios: Studio[]; current?: Studio; mini: boolean }) {
  const { me } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<StudioKey | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, [open]);
  const go = useCallback(async (s: Studio) => {
    setOpen(false);
    if (s.key === current?.key) return;
    const acting = !!me?.actingAs;
    // DEL Studio and the own Instructor Studio share /studio: the API is told which one (and records the real person).
    if (s.key === "del" || acting) {
      setBusy(s.key);
      try {
        await api("/auth/act-as", { method: "POST", body: { mode: s.key === "del" ? "del" : "self" } });
        window.location.assign(s.href);
      } catch (e) { toast("error", errMsg(e)); setBusy(null); }
      return;
    }
    router.push(s.href);
  }, [current?.key, me?.actingAs, router, toast]);
  const many = studios.length > 1;
  const Icon = current?.icon;
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => many && setOpen((o) => !o)} aria-haspopup={many ? "menu" : undefined} aria-expanded={many ? open : undefined}
        title={mini ? current?.label : undefined} data-testid="studio-switcher"
        className={`flex w-full items-center gap-2.5 rounded-lg bg-surface-2 px-3 py-2.5 text-left ${many ? "hover:bg-violet-soft" : "cursor-default"} ${mini ? "justify-center !px-0" : ""}`}>
        {Icon ? (busy ? <Loader2 className="size-[18px] shrink-0 animate-spin text-violet" /> : <Icon className="size-[18px] shrink-0 text-violet" aria-hidden="true" />) : null}
        {!mini ? <span className="min-w-0 flex-1"><span className="block truncate text-[0.93rem] font-extrabold text-ink">{current?.label}</span>{many ? <span className="block text-xs text-muted">Switch studio</span> : null}</span> : <span className="sr-only">{current?.label}{many ? ", switch studio" : ""}</span>}
        {many && !mini ? <ChevronDown className={`size-4 text-muted transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" /> : null}
      </button>
      {open ? (
        <div role="menu" aria-label="Your studios" className={`pop-in absolute z-40 mt-1 w-64 rounded-tile border border-line bg-surface p-1.5 shadow-float ${mini ? "left-full top-0 ml-2" : "left-0 right-0 w-auto"}`}>
          {studios.map((s) => (
            <button key={s.key} type="button" role="menuitemradio" aria-checked={s.key === current?.key} onClick={() => void go(s)} data-testid={`switch-${s.key}`}
              className="flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-surface-2">
              <s.icon className="mt-0.5 size-[18px] shrink-0 text-violet" aria-hidden="true" />
              <span className="min-w-0 flex-1"><span className="block text-sm font-bold text-ink">{s.label}</span><span className="block text-xs text-muted">{s.hint}</span></span>
              {s.key === current?.key ? <Check className="mt-0.5 size-4 text-violet" aria-hidden="true" /> : null}
            </button>
          ))}
          <div className="my-1 border-t border-line" />
          <Link href="/" role="menuitem" className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-bold text-ink-2 hover:bg-surface-2 hover:text-ink"><Store className="size-[18px]" />Marketplace</Link>
        </div>
      ) : null}
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
  const n = items.length;
  // every row is full: no empty grey cell whatever the count (mobile QA 2026-11-26)
  const md = n <= 4 ? ["", "md:grid-cols-1", "md:grid-cols-2", "md:grid-cols-3", "md:grid-cols-4"][n] : n === 5 ? "md:grid-cols-6 lg:grid-cols-5" : n % 3 === 0 ? "md:grid-cols-3" : "md:grid-cols-4";
  return (
    <dl className={`grid grid-cols-2 gap-px overflow-hidden rounded-panel border border-line bg-line ${md}`}>
      {items.map((k, i) => (
        <div key={k.label} className={`bg-surface p-5 ${n % 2 && i === n - 1 ? "col-span-2" : ""} ${n === 5 ? (i < 3 ? "md:col-span-2 lg:col-span-1" : "md:col-span-3 lg:col-span-1") : n % 2 && i === n - 1 ? "md:col-span-1" : ""}`}>
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
    <StackTable className="overflow-x-auto rounded-tile border border-line bg-surface">
      <table className="w-full text-left text-sm" style={{ minWidth: min }}>
        <thead className="border-b border-line bg-surface-2/60 text-muted">
          <tr>{head.map((h, i) => <th key={i} className="px-4 py-3 font-bold">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-line">{children}</tbody>
      </table>
      {empty}
    </StackTable>
  );
}
