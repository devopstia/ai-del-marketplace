"use client";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowRight, BookOpen, CornerDownLeft, FileText, LifeBuoy, Loader2, Mail, MonitorPlay, PlayCircle, Search, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";
import { list, paged, toCourseCard, toLearningItem } from "@/lib/normalize";
import { toCategories, type HelpItem } from "@/lib/help";
import { studioPagesFor } from "@/lib/studio-nav";
import type { CourseCard, LearningItem } from "@/lib/types";
import { useDebounced } from "../Pager";
import { useAuth } from "../AuthProvider";
import { CourseCover } from "../CourseCover";

/**
 * Quick search (⌘K / Ctrl+K, or "/" when not typing), owner-approved 2026-11-26. One palette on every page: courses
 * from the catalogue search, and for a signed-in account its own courses (to the player), the studio pages it may open
 * (the same menus the sidebars draw, never more) and help. The header search field and the studio "Search" button
 * open it; there is no second search UI.
 */
const Ctx = createContext<{ open: () => void }>({ open: () => {} });
export const useQuickSearch = () => useContext(Ctx);

const typing = (t: EventTarget | null) => {
  const el = t as HTMLElement | null;
  return !!el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));
};

export function QuickSearchProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey && !typing(e.target) && !document.querySelector("dialog[open]")) {
        e.preventDefault();
        setOpen(true);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
  const value = useMemo(() => ({ open: () => setOpen(true) }), []);
  return (
    <Ctx.Provider value={value}>
      {children}
      {open ? <Palette onClose={() => setOpen(false)} /> : null}
    </Ctx.Provider>
  );
}

/** "⌘K" on Apple devices, "Ctrl K" elsewhere (decided after mount, so the server render stays neutral). */
function useShortcutLabel() {
  const [mac, setMac] = useState<boolean | null>(null);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- platform is only known in the browser
  useEffect(() => { setMac(/Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent)); }, []);
  return mac === null ? null : mac ? "⌘K" : "Ctrl K";
}

const Kbd = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <kbd className={`rounded-md border border-line bg-surface px-1.5 py-0.5 font-sans text-[0.72rem] font-bold leading-none text-muted ${className}`}>{children}</kbd>
);

/** The header search field: looks and sits where the old field was, opens the palette. */
export function SearchField({ className = "flex" }: { className?: string }) {
  const { open } = useQuickSearch();
  const keys = useShortcutLabel();
  return (
    <button type="button" onClick={open} aria-haspopup="dialog" aria-keyshortcuts="Meta+K Control+K /" data-testid="search-open"
      className={`relative h-11 w-full items-center gap-2.5 rounded-full border-[1.5px] border-line bg-surface-2 pl-3.5 pr-2.5 text-left text-[0.95rem] text-muted hover:border-line-strong ${className}`}>
      <Search className="size-4 shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate">Search courses, pages and help</span>
      {keys ? <Kbd className="max-lg:hidden">{keys}</Kbd> : null}
    </button>
  );
}

/** Icon button (phones in the marketplace header) or "Search" button (studio top bar). */
export function SearchButton({ compact = false, className = "" }: { compact?: boolean; className?: string }) {
  const { open } = useQuickSearch();
  const keys = useShortcutLabel();
  return (
    <button type="button" onClick={open} aria-haspopup="dialog" aria-keyshortcuts="Meta+K Control+K /" aria-label={compact ? "Search" : undefined}
      data-testid={compact ? "search-open-icon" : "search-open"} className={`btn btn-ghost btn-sm ${compact ? "!px-2.5" : "max-sm:!px-2"} ${className}`}>
      <Search className="size-[18px]" aria-hidden="true" />
      {compact ? null : <><span className="max-sm:sr-only">Search</span>{keys ? <Kbd className="ml-1 max-lg:hidden">{keys}</Kbd> : null}</>}
    </button>
  );
}

type Result = { id: string; href: string; title: string; sub?: string; icon?: LucideIcon; course?: CourseCard; testId?: string };
type Group = { key: string; label: string; items: Result[] };

const HELP_PAGES: (Omit<Result, "id"> & { words: string })[] = [
  { href: "/help", title: "Platform videos", sub: "Short videos on using the marketplace", icon: MonitorPlay, words: "help videos tutorial how to guide" },
  { href: "/support", title: "Help and support", sub: "Ask a question or follow a request", icon: LifeBuoy, words: "help support ticket problem question" },
  { href: "/contact", title: "Contact us", sub: "Write to DevOps Easy Learning", icon: Mail, words: "contact email message enrol enroll" },
  { href: "/policies/access-and-refunds", title: "Access and refunds policy", sub: "12 months of access, when refunds apply", icon: ShieldCheck, words: "refund access renew expiry policy money back" },
  { href: "/policies/terms", title: "Terms of use", sub: "Rules for learning, buying and teaching", icon: FileText, words: "terms conditions policy legal" },
  { href: "/policies/privacy", title: "Privacy policy", sub: "What we collect and why", icon: FileText, words: "privacy data cookies gdpr policy" },
];

const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "");
/** Every word of the query appears somewhere; titles that start with the query rank first. */
function rank<T>(items: T[], q: string, text: (t: T) => string, title: (t: T) => string): T[] {
  const words = norm(q).split(/\s+/).filter(Boolean);
  if (!words.length) return items;
  const nq = norm(q.trim());
  return items
    .map((t, i) => ({ t, i, hay: norm(text(t)), head: norm(title(t)) }))
    .filter((x) => words.every((w) => x.hay.includes(w)))
    .sort((a, b) => Number(b.head.startsWith(nq)) - Number(a.head.startsWith(nq)) || a.i - b.i)
    .map((x) => x.t);
}

// Public, rarely changing: fetched once per page load, on the first open.
let helpVideos: Promise<HelpItem[]> | null = null;
const loadHelpVideos = () => (helpVideos ??= api("/help/videos").then((r) => toCategories(r).categories.flatMap((c) => c.items)).catch(() => { helpVideos = null; return []; }));

function Palette({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const { me } = useAuth();
  const ref = useRef<HTMLDialogElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const uid = useId();
  const [q, setQ] = useState("");
  const dq = useDebounced(q.trim(), 220);
  const [courses, setCourses] = useState<{ q: string; items: CourseCard[]; total: number } | null>(null);
  const [searching, setSearching] = useState(false);
  const [failed, setFailed] = useState(false);
  const [mine, setMine] = useState<LearningItem[]>([]);
  const [videos, setVideos] = useState<HelpItem[]>([]);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    // The page behind keeps its scroll position and doesn't scroll under the sheet.
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => { document.documentElement.style.overflow = prev; };
  }, []);
  useEffect(() => {
    let alive = true;
    void loadHelpVideos().then((v) => alive && setVideos(v));
    if (me) api("/me/learning").then((r) => alive && setMine(list(r, "items", "courses", "enrollments").map(toLearningItem))).catch(() => {});
    return () => { alive = false; };
  }, [me]);

  // Catalogue search: one request per pause in typing (debounced), the previous one cancelled.
  useEffect(() => {
    if (dq.length < 2) { setCourses(null); setSearching(false); setFailed(false); return; } // eslint-disable-line react-hooks/set-state-in-effect
    const ctl = new AbortController();
    setSearching(true);
    api("/courses", { query: { q: dq, pageSize: 5 }, signal: ctl.signal })
      .then((r) => { const p = paged(r, toCourseCard, "courses"); setCourses({ q: dq, items: p.items, total: p.total }); setFailed(false); })
      .catch(() => { if (!ctl.signal.aborted) setFailed(true); })
      .finally(() => { if (!ctl.signal.aborted) setSearching(false); });
    return () => ctl.abort();
  }, [dq]);

  const groups = useMemo<Group[]>(() => {
    const term = q.trim();
    const out: Group[] = [];
    const courseItems: Result[] = [];
    if (term.length >= 2 && courses && courses.q === dq) {
      for (const c of courses.items) courseItems.push({ id: `c-${c.id}`, href: `/courses/${c.slug}`, title: c.title, sub: c.instructor.name, course: c, testId: "qs-course" });
    }
    courseItems.push(term
      ? { id: "c-all", href: `/courses?q=${encodeURIComponent(term)}`, title: `See all courses for “${term}”`, icon: ArrowRight, sub: courses && courses.q === dq && courses.total > courses.items.length ? `${courses.total} courses` : undefined }
      : { id: "c-all", href: "/courses", title: "Browse all courses", icon: BookOpen });
    out.push({ key: "courses", label: "Courses", items: courseItems });

    if (me) {
      const own = rank(mine, term, (m) => `${m.course.title} ${m.course.instructor.name}`, (m) => m.course.title).slice(0, term ? 5 : 4);
      if (own.length) out.push({ key: "mine", label: "Your courses", items: own.map((m) => ({ id: `m-${m.course.id}`, href: `/learn/${m.course.slug}`, title: m.course.title, sub: m.access?.state === "expired" ? "Access ended · renew to continue" : `${m.progressPct}% complete · continue learning`, icon: PlayCircle, testId: "qs-mine" })) });
      const pages = studioPagesFor(me);
      const shown = term
        ? rank(pages, term, (p) => `${p.label} ${p.section ?? ""} ${p.studio}`, (p) => p.label).slice(0, 8)
        : pages.filter((p) => /^\/(student|studio|admin)$/.test(p.href));
      if (shown.length) out.push({ key: "pages", label: "Studio pages", items: shown.map((p) => ({ id: `p-${p.href}`, href: p.href, title: p.href.split("/").length === 2 ? p.studio : p.label, sub: p.href.split("/").length === 2 ? "Dashboard" : `${p.studio}${p.section ? ` · ${p.section}` : ""}`, icon: p.icon, testId: "qs-page" })) });
    }

    const help: Result[] = rank(HELP_PAGES, term, (h) => `${h.title} ${h.words}`, (h) => h.title).slice(0, term ? 4 : 3).map((h) => ({ ...h, id: `h-${h.href}` }));
    if (term) help.push(...rank(videos, term, (v) => `${v.title} ${v.summary}`, (v) => v.title).slice(0, 4).map((v) => ({ id: `v-${v.slug}`, href: `/help/${v.slug}`, title: v.title, sub: "Platform video", icon: MonitorPlay })));
    if (help.length) out.push({ key: "help", label: "Help", items: help });
    // In a studio, its pages are what people jump to most: they come first there.
    if (/^\/(student|studio|admin)(\/|$)/.test(pathname)) out.sort((a, b) => Number(b.key === "pages") - Number(a.key === "pages"));
    return out;
  }, [q, dq, courses, me, mine, videos, pathname]);

  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- a new result list starts at its first row
  useEffect(() => { setActive(0); }, [flat.length, dq]);
  const current = flat[Math.min(active, flat.length - 1)];
  useEffect(() => {
    if (current) listRef.current?.querySelector(`[data-id="${CSS.escape(current.id)}"]`)?.scrollIntoView({ block: "nearest" });
  }, [current]);

  const go = useCallback((r: Result | undefined) => {
    if (!r) return;
    onClose();
    router.push(r.href);
  }, [onClose, router]);

  const onKey = (e: React.KeyboardEvent) => {
    // Esc closes at once, even with text typed (a search field would otherwise only clear itself first)
    if (e.key === "Escape") { e.preventDefault(); onClose(); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => (flat.length ? (i + 1) % flat.length : 0)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => (flat.length ? (i - 1 + flat.length) % flat.length : 0)); }
    else if (e.key === "Home" && e.ctrlKey) { e.preventDefault(); setActive(0); }
    else if (e.key === "End" && e.ctrlKey) { e.preventDefault(); setActive(flat.length - 1); }
    else if (e.key === "Enter" && !e.nativeEvent.isComposing) { e.preventDefault(); go(current); }
  };

  const optId = (r: Result) => `${uid}-${r.id}`;
  const listId = `${uid}-list`;
  const count = flat.length;
  const waiting = q.trim().length >= 2 && (searching || dq !== q.trim());
  return (
    <dialog ref={ref} onClose={onClose} onCancel={(e) => { e.preventDefault(); onClose(); }} onClick={(e) => e.target === ref.current && onClose()}
      aria-label="Quick search" data-testid="quick-search"
      className="pop-in m-0 h-dvh max-h-none w-full max-w-none overflow-hidden bg-surface p-0 text-ink backdrop:bg-[rgba(8,10,25,.6)] sm:mx-auto sm:mt-[11vh] sm:h-fit sm:max-h-[min(36rem,80dvh)] sm:w-[min(100%-2rem,40rem)] sm:rounded-panel sm:border sm:border-line sm:shadow-float">
      <div className="flex h-full max-h-[inherit] flex-col pt-[env(safe-area-inset-top)] sm:pt-0" onKeyDown={onKey}>
        <div className="flex items-center gap-2 border-b border-line px-4">
          {waiting ? <Loader2 className="size-5 shrink-0 animate-spin text-muted" aria-hidden="true" /> : <Search className="size-5 shrink-0 text-muted" aria-hidden="true" />}
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} type="search" enterKeyHint="go" autoComplete="off" spellCheck={false}
            role="combobox" aria-expanded="true" aria-controls={listId} aria-autocomplete="list" aria-activedescendant={current ? optId(current) : undefined}
            aria-label="Search courses, your courses, studio pages and help" placeholder="Search courses, pages and help"
            className="h-14 min-w-0 flex-1 bg-transparent text-base text-ink placeholder:text-muted focus-visible:!outline-none [&::-webkit-search-cancel-button]:hidden" data-testid="quick-search-input" />
          <button type="button" onClick={onClose} aria-label="Close search" className="btn btn-ghost btn-sm -mr-2 shrink-0 !px-2 text-sm">
            <span className="sm:hidden">Cancel</span><Kbd className="max-sm:hidden">Esc</Kbd>
          </button>
        </div>
        <div ref={listRef} id={listId} role="listbox" aria-label="Results" className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          {groups.map((g) => (
            <div key={g.key} role="group" aria-labelledby={`${uid}-g-${g.key}`} className="pb-1.5" data-testid={`qs-group-${g.key}`}>
              <p id={`${uid}-g-${g.key}`} className="px-3 pb-1 pt-2 text-[0.7rem] font-bold uppercase tracking-[0.08em] text-muted">{g.label}</p>
              {g.items.map((r) => {
                const on = r === current;
                const Icon = r.icon;
                return (
                  <div key={r.id} id={optId(r)} data-id={r.id} role="option" aria-selected={on} data-testid={r.testId}
                    onClick={() => go(r)} onMouseMove={() => { const i = flat.indexOf(r); if (i !== active) setActive(i); }}
                    className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 ${on ? "bg-violet-soft" : ""}`}>
                    {r.course ? (
                      <span className="w-14 shrink-0"><CourseCover slug={r.course.slug} title={r.course.title} thumbnailUrl={r.course.thumbnailUrl} size="sm" className="!rounded-md" /></span>
                    ) : Icon ? (
                      <span className={`grid size-8 shrink-0 place-items-center rounded-md ${on ? "text-violet" : "bg-surface-2 text-ink-2"}`}><Icon className="size-4" aria-hidden="true" /></span>
                    ) : null}
                    <span className="min-w-0 flex-1">
                      <span className={`block truncate text-[0.93rem] font-bold ${on ? "text-violet" : "text-ink"}`}>{r.title}</span>
                      {r.sub ? <span className="block truncate text-xs text-muted">{r.sub}</span> : null}
                    </span>
                    {on ? <CornerDownLeft className="size-4 shrink-0 text-violet max-sm:hidden" aria-hidden="true" /> : null}
                  </div>
                );
              })}
            </div>
          ))}
          {q.trim().length >= 2 && !waiting && courses?.q === dq && !courses.items.length ? (
            <p className="px-3 pb-2 text-sm text-ink-2" data-testid="qs-no-courses">No course matches “{dq}”. Try a shorter or different word.</p>
          ) : null}
          {failed ? <p className="px-3 pb-2 text-sm text-rose" role="alert">Course search isn’t available right now. Try again in a moment.</p> : null}
        </div>
        <div className="flex items-center gap-4 border-t border-line px-4 py-2 text-xs text-muted max-sm:hidden" aria-hidden="true">
          <span className="flex items-center gap-1.5"><Kbd>↑</Kbd><Kbd>↓</Kbd>move</span>
          <span className="flex items-center gap-1.5"><Kbd>Enter</Kbd>open</span>
          <span className="flex items-center gap-1.5"><Kbd>Esc</Kbd>close</span>
        </div>
        <p className="sr-only" aria-live="polite">{waiting ? "Searching" : `${count} ${count === 1 ? "result" : "results"}`}</p>
      </div>
    </dialog>
  );
}
