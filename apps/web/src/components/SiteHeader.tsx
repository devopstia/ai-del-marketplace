"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Tag, BookOpen, ChevronDown, LayoutDashboard, LogOut, Menu, Receipt, Search, Shield, ShoppingCart, User, X, GraduationCap } from "lucide-react";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";
import { useAuth } from "./AuthProvider";
import { Avatar } from "./Avatar";

function SearchBox({ className = "", onDone }: { className?: string; onDone?: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  return (
    <form
      role="search"
      className={`relative ${className}`}
      onSubmit={(e) => {
        e.preventDefault();
        router.push(q.trim() ? `/courses?q=${encodeURIComponent(q.trim())}` : "/courses");
        onDone?.();
      }}
    >
      <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        type="search"
        aria-label="Search courses"
        placeholder="Search Kubernetes, MCP agents, Bedrock…"
        className="h-11 w-full rounded-full border-[1.5px] border-line bg-surface-2 pl-10 pr-4 text-[0.95rem] text-ink placeholder:text-muted focus:border-violet focus:bg-surface focus:outline-none"
      />
    </form>
  );
}

function UserMenu() {
  const { me, logout, has } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, []);
  if (!me) return null;
  const item = "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-bold text-ink-2 hover:bg-surface-2 hover:text-ink";
  return (
    <div className="relative" ref={ref}>
      <button type="button" className="flex items-center gap-1.5 rounded-full p-0.5 pr-2 hover:bg-surface-2" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)} data-testid="user-menu">
        <Avatar name={me.name} src={me.avatarUrl} size={34} />
        <ChevronDown className="hidden size-4 text-muted sm:block" aria-hidden="true" />
      </button>
      {open ? (
        <div role="menu" className="pop-in absolute right-0 top-12 z-50 w-64 rounded-tile border border-line bg-surface p-2 shadow-float">
          <div className="border-b border-line px-3 pb-3 pt-1">
            <p className="font-bold text-ink">{me.name}</p>
            <p className="truncate text-sm text-muted">{me.email}</p>
          </div>
          <div className="flex flex-col py-1" onClick={() => setOpen(false)}>
            <Link role="menuitem" className={item} href="/my-learning"><BookOpen className="size-4" />My learning</Link>
            {has("instructor") ? <Link role="menuitem" className={item} href="/studio"><LayoutDashboard className="size-4" />Instructor studio</Link> : null}
            {has("admin") ? <Link role="menuitem" className={item} href="/admin"><Shield className="size-4" />Admin</Link> : null}
            <Link role="menuitem" className={item} href="/orders"><Receipt className="size-4" />Orders and receipts</Link>
            <Link role="menuitem" className={item} href="/account"><User className="size-4" />Account</Link>
          </div>
          <button
            role="menuitem"
            type="button"
            className={`${item} w-full border-t border-line pt-2.5`}
            onClick={async () => {
              setOpen(false);
              await logout();
              router.push("/");
              router.refresh();
            }}
          >
            <LogOut className="size-4" />Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}

/** `dealsCount`: courses on sale right now; the Deals link only exists while there are some. */
export function SiteHeader({ dealsCount = 0 }: { dealsCount?: number }) {
  const { me, loading, cartCount, has } = useAuth();
  const [mobile, setMobile] = useState(false);
  const pathname = usePathname();
  const teachHref = has("instructor") ? "/studio" : "/teach";
  const nav = "rounded-lg px-3 py-2 text-[0.92rem] font-bold text-ink-2 hover:bg-surface-2 hover:text-ink";
  const active = (p: string) => (pathname.startsWith(p) ? "text-ink" : "");
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-[color-mix(in_oklab,var(--paper)_88%,transparent)] backdrop-blur-md">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2">Skip to content</a>
      <div className="container-x flex h-16 items-center gap-2 sm:gap-3">
        <Logo />
        <nav className="ml-2 hidden items-center lg:flex" aria-label="Main">
          <Link href="/courses" className={`${nav} ${active("/courses")}`}>Browse courses</Link>
          {dealsCount > 0 ? <Link href="/deals" className={`${nav} ${active("/deals")} inline-flex items-center gap-1.5`}>Deals<span className="rounded-full bg-rose-soft px-1.5 text-xs font-extrabold tabular-nums text-rose">{dealsCount}</span></Link> : null}
        </nav>
        <SearchBox className="mx-2 hidden max-w-md flex-1 md:block" />
        <div className="ml-auto flex items-center gap-1">
          <nav className="hidden items-center lg:flex" aria-label="Account">
            <Link href={teachHref} className={nav}>{has("instructor") ? "Studio" : "Teach on DEL"}</Link>
            {has("admin") ? <Link href="/admin" className={nav}>Admin</Link> : null}
            {me ? <Link href="/my-learning" className={`${nav} ${active("/my-learning")}`}>My learning</Link> : null}
          </nav>
          <ThemeToggle className="hidden sm:inline-flex" />
          <Link href="/cart" className="btn btn-ghost btn-sm relative !px-2.5" aria-label={`Cart, ${cartCount} items`}>
            <ShoppingCart className="size-[19px]" />
            {cartCount > 0 ? (
              <span className="absolute -right-0.5 -top-0.5 grid min-w-[18px] place-items-center rounded-full bg-violet px-1 text-[0.68rem] font-bold leading-[18px] text-on-violet">{cartCount}</span>
            ) : null}
          </Link>
          {loading ? (
            <span className="h-9 w-20" />
          ) : me ? (
            <UserMenu />
          ) : (
            <div className="hidden items-center gap-2 sm:flex">
              <Link href="/login" className="btn btn-ghost btn-sm">Log in</Link>
              <Link href="/register" className="btn btn-primary btn-sm">Join free</Link>
            </div>
          )}
          <button type="button" className="btn btn-ghost btn-sm !px-2.5 lg:hidden" aria-label="Open menu" aria-expanded={mobile} onClick={() => setMobile(true)}>
            <Menu className="size-5" />
          </button>
        </div>
      </div>
      {mobile ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button type="button" className="absolute inset-0 bg-black/40" aria-label="Close menu" onClick={() => setMobile(false)} />
          <div className="pop-in absolute inset-y-0 right-0 flex w-[min(22rem,88vw)] flex-col gap-1 overflow-y-auto bg-surface p-4 shadow-float">
            <div className="mb-3 flex items-center justify-between">
              <span className="flex items-center gap-2"><span className="font-display text-lg font-bold">Menu</span><ThemeToggle /></span>
              <button type="button" className="btn btn-ghost btn-sm !px-2" aria-label="Close menu" onClick={() => setMobile(false)}><X className="size-5" /></button>
            </div>
            <SearchBox className="mb-3" onDone={() => setMobile(false)} />
            {[
              ["/courses", "Browse courses", GraduationCap],
              ...(dealsCount > 0 ? [["/deals", `Deals (${dealsCount})`, Tag]] : []),
              [teachHref, has("instructor") ? "Instructor studio" : "Teach on DEL", LayoutDashboard],
              ...(me ? [["/my-learning", "My learning", BookOpen], ["/orders", "Orders and receipts", Receipt], ["/account", "Account", User]] : []),
              ...(has("admin") ? [["/admin", "Admin", Shield]] : []),
            ].map(([href, label, Icon]) => {
              const I = Icon as typeof BookOpen;
              return (
                <Link key={href as string} href={href as string} onClick={() => setMobile(false)} className="flex items-center gap-3 rounded-lg px-3 py-3 font-bold text-ink hover:bg-surface-2">
                  <I className="size-5 text-muted" />{label as string}
                </Link>
              );
            })}
            {!me ? (
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Link href="/login" onClick={() => setMobile(false)} className="btn btn-outline">Log in</Link>
                <Link href="/register" onClick={() => setMobile(false)} className="btn btn-primary">Join free</Link>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </header>
  );
}
