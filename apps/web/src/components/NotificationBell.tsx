"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { api } from "@/lib/api";
import { obj } from "@/lib/normalize";
import { dateTime } from "@/lib/format";
import { useAuth } from "./AuthProvider";

type Item = { id: string; title: string; body: string; link: string | null; read: boolean; createdAt: string };

/**
 * In-platform notifications (owner 2026-11-26: refund decisions and payments). Signed-in users only; checks every
 * two minutes while the tab is visible. Opening the list marks everything shown as read. Esc or a click outside closes it.
 */
export function NotificationBell({ className = "" }: { className?: string }) {
  const { me } = useAuth();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    api("/me/notifications?limit=15").then((r) => {
      const o = obj(r);
      setUnread(Number(o.unread ?? 0));
      setItems((Array.isArray(o.items) ? o.items : []).map((x) => { const i = obj(x); return { id: String(i.id), title: String(i.title), body: String(i.body), link: (i.link as string) ?? null, read: i.read === true, createdAt: String(i.createdAt) }; }));
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!me) return;
    load();
    const t = setInterval(() => { if (document.visibilityState === "visible") load(); }, 120_000);
    return () => clearInterval(t);
  }, [me, load]);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", esc); };
  }, [open]);

  if (!me) return null;

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) {
      api("/me/notifications/read", { method: "POST", body: {} }).then((r) => setUnread(Number(obj(r).unread ?? 0))).catch(() => undefined);
    }
  }

  return (
    <div className={`relative ${className}`} ref={ref}>
      <button type="button" className="btn btn-ghost btn-sm relative !px-2.5" aria-haspopup="dialog" aria-expanded={open} aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"} onClick={toggle} data-testid="notification-bell">
        <Bell className="size-[19px]" />
        {unread > 0 ? <span className="absolute -right-0.5 -top-0.5 grid min-w-[18px] place-items-center rounded-full bg-violet px-1 text-[0.68rem] font-bold leading-[18px] text-on-violet">{unread > 9 ? "9+" : unread}</span> : null}
      </button>
      {open ? (
        <div role="dialog" aria-label="Notifications" className="pop-in absolute right-0 top-11 z-50 w-[min(22rem,calc(100vw-1.5rem))] rounded-tile border border-line bg-surface p-2 shadow-float" data-testid="notification-list">
          <p className="px-2 pb-2 pt-1 font-display font-bold">Notifications</p>
          {items.length ? (
            <ul className="max-h-[60vh] divide-y divide-line overflow-y-auto">
              {items.map((i) => {
                const body = <><span className="flex items-start justify-between gap-2"><span className="font-bold text-ink">{i.title}</span>{!i.read ? <span className="mt-1.5 size-2 shrink-0 rounded-full bg-violet" aria-label="New" /> : null}</span><span className="mt-0.5 block text-sm text-ink-2">{i.body}</span><span className="mt-1 block text-xs text-muted">{dateTime(i.createdAt)}</span></>;
                return <li key={i.id}>{i.link ? <Link href={i.link} className="block rounded-lg px-2 py-2.5 hover:bg-surface-2" onClick={() => setOpen(false)}>{body}</Link> : <div className="px-2 py-2.5">{body}</div>}</li>;
              })}
            </ul>
          ) : <p className="px-2 pb-3 text-sm text-ink-2">Nothing yet. Refund decisions and other updates about your account appear here.</p>}
        </div>
      ) : null}
    </div>
  );
}
