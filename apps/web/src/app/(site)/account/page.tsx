"use client";
import { Suspense, useEffect, useState } from "react";
import { SecuritySection } from "@/components/auth/SecuritySection";
import { Laptop, Loader2, Smartphone } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { list, obj } from "@/lib/normalize";
import { date, dateTime } from "@/lib/format";
import type { Session } from "@/lib/types";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/Toast";
import { Avatar } from "@/components/Avatar";
import { Skeleton } from "@/components/Empty";

function device(ua?: string | null) {
  if (!ua) return "Unknown device";
  const b = /Edg\//.test(ua) ? "Edge" : /Firefox\//.test(ua) ? "Firefox" : /(Headless)?Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Browser";
  const os = /Windows/.test(ua) ? "Windows" : /Mac OS X/.test(ua) ? "macOS" : /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Linux/.test(ua) ? "Linux" : "";
  return `${b}${os ? ` on ${os}` : ""}`;
}

function ProfileForm() {
  const { me, refresh } = useAuth();
  const toast = useToast();
  const [name, setName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const value = name ?? me?.name ?? "";
  return (
    <form className="flex flex-wrap items-end gap-3" onSubmit={async (e) => {
      e.preventDefault();
      setBusy(true);
      try { await api("/me/profile", { method: "PATCH", body: { name: value.trim() } }); await refresh(); setName(null); toast("ok", "Name updated."); }
      catch (err) { toast("error", errMsg(err)); } finally { setBusy(false); }
    }}>
      <div className="min-w-0 flex-1"><label className="label" htmlFor="acc-name">Display name</label><input id="acc-name" className="field" maxLength={100} required value={value} onChange={(e) => setName(e.target.value)} /></div>
      <button className="btn btn-outline" disabled={busy || value.trim() === me?.name}>{busy ? <Loader2 className="size-4 animate-spin" /> : null}Save name</button>
    </form>
  );
}

export default function AccountPage() {
  const { me } = useAuth();
  const toast = useToast();
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    api("/auth/sessions").then((r) => setSessions(list(r, "sessions").map((s) => {
      const o = obj(s);
      return { id: String(o.id), ip: o.ip as string, userAgent: o.userAgent as string, createdAt: o.createdAt as string, expiresAt: o.expiresAt as string, current: Boolean(o.current ?? o.isCurrent) };
    }))).catch(() => setSessions([]));
  }, []);

  async function revoke(id: string) {
    setBusy(id);
    try {
      await api(`/auth/sessions/${id}`, { method: "DELETE" });
      setSessions((s) => s?.filter((x) => x.id !== id) ?? null);
      toast("ok", "Signed out of that device.");
    } catch (e) { toast("error", errMsg(e)); } finally { setBusy(null); }
  }

  return (
    <div className="container-x max-w-4xl pt-10">
      <h1 className="font-display text-[2.4rem] font-extrabold">Account</h1>
      <section className="mt-8 grid gap-6 rounded-panel border border-line bg-surface p-6 sm:grid-cols-[auto_1fr] sm:p-8">
        {me ? <Avatar name={me.name} src={me.avatarUrl} size={80} /> : <Skeleton className="size-20 !rounded-full" />}
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div><dt className="text-muted">Name</dt><dd className="text-base font-bold">{me?.name ?? "—"}</dd></div>
          <div><dt className="text-muted">Email</dt><dd className="text-base font-bold break-all">{me?.email ?? "—"}</dd></div>
          <div><dt className="text-muted">Roles</dt><dd className="mt-1 flex flex-wrap gap-1.5">{me?.roles.map((r) => <span key={r} className="chip">{r.replace("_", " ")}</span>)}</dd></div>
          <div><dt className="text-muted">Member since</dt><dd className="text-base font-bold">{date(me?.createdAt)}</dd></div>
        </dl>
      </section>

      <section className="mt-6 rounded-panel border border-line bg-surface p-6 sm:p-8">
        <ProfileForm />
      </section>

      <Suspense><SecuritySection /></Suspense>

      <section className="mt-10">
        <h2 className="font-display text-2xl font-extrabold">Where you’re signed in</h2>
        <p className="mt-1 text-ink-2">Sign out of any device you don’t recognise. Sessions expire after 30 days.</p>
        {!sessions ? <Skeleton className="mt-5 h-32" /> : (
          <ul className="mt-5 divide-y divide-line rounded-tile border border-line bg-surface">
            {sessions.map((s) => {
              const Icon = /Mobile|Android|iPhone/.test(s.userAgent ?? "") ? Smartphone : Laptop;
              return (
                <li key={s.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                  <Icon className="size-6 text-muted" />
                  <div className="min-w-0 flex-1">
                    <p className="font-bold">{device(s.userAgent)}{s.current ? <span className="ml-2 chip !bg-mint-soft !text-mint">This device</span> : null}</p>
                    <p className="text-sm text-muted">{s.ip ?? "Unknown IP"}, signed in {dateTime(s.createdAt)}</p>
                  </div>
                  {!s.current ? <button type="button" className="btn btn-outline btn-sm" disabled={busy === s.id} onClick={() => revoke(s.id)}>{busy === s.id ? <Loader2 className="size-4 animate-spin" /> : null}Sign out</button> : null}
                </li>
              );
            })}
            {!sessions.length ? <li className="px-5 py-6 text-ink-2">No other sessions.</li> : null}
          </ul>
        )}
      </section>
    </div>
  );
}
