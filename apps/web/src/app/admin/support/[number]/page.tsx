"use client";
import Link from "next/link";
import { Fragment, use, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { obj } from "@/lib/normalize";
import { moneyExact } from "@/lib/format";
import { Skeleton } from "@/components/Empty";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/components/AuthProvider";
import { CATEGORIES, Composer, PRIORITY, StatusPill, Thread, categoryLabel, toTicket, when } from "@/components/support/shared";

const toStaff = (r: unknown) => (Array.isArray(obj(r).items) ? (obj(r).items as { id: string; name: string }[]) : []);
const KINDS: [string, string, string][] = [
  ["reply", "Reply", "Send reply"],
  ["request_info", "Ask for information", "Ask and wait"],
  ["resolve", "Resolve", "Resolve"],
  ["note", "Internal note", "Add note"],
];

export default function StaffTicket({ params }: { params: Promise<{ number: string }> }) {
  const { number } = use(params);
  const toast = useToast();
  const { me } = useAuth();
  const isSuper = !!me?.roles.includes("super_admin");
  const { data: t, error, setData } = useApi(`/support/tickets/${encodeURIComponent(number)}`, toTicket);
  const { data: staff } = useApi("/admin/support/staff", toStaff);
  const [kind, setKind] = useState("reply");
  const [busy, setBusy] = useState(false);

  async function send(body: string, files: { key: string; name: string; mime: string; sizeBytes: number }[]) {
    setBusy(true);
    try { setData(toTicket(await api(`/admin/support/tickets/${t!.number}/messages`, { method: "POST", body: { kind, body, attachments: files } }))); toast("ok", kind === "note" ? "Note added." : "Sent. The requester gets an email."); return true; }
    catch (e) { toast("error", errMsg(e)); return false; } finally { setBusy(false); }
  }
  async function patch(body: object) {
    setBusy(true);
    try { setData(toTicket(await api(`/admin/support/tickets/${t!.number}`, { method: "PATCH", body }))); toast("ok", "Saved."); }
    catch (e) { toast("error", errMsg(e)); } finally { setBusy(false); }
  }

  if (error) return <p className="text-rose">{error}</p>;
  if (!t) return <Skeleton className="h-96" />;
  const ctx = t.context ?? {};
  const active = KINDS.find(([k]) => k === kind)!;
  return (
    <>
      <Link href="/admin/support" className="link inline-flex items-center gap-1 text-sm"><ArrowLeft className="size-4" />Support queue</Link>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-[clamp(1.5rem,2.6vw,2rem)] font-extrabold leading-tight">{t.subject}</h1>
          <p className="mt-1 text-sm text-muted">{t.number} · opened {when(t.createdAt)} by {t.requester.name} ({t.requester.email})</p>
        </div>
        <StatusPill status={t.status} staff />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0">
          <Thread messages={t.messages} viewerIsStaff />
          {t.status !== "closed" ? (
            <div className="mt-6 rounded-panel border border-line bg-surface p-5">
              <div className="mb-3 flex flex-wrap gap-1.5" role="tablist" aria-label="Message type">
                {KINDS.map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={kind === k} onClick={() => setKind(k)} className={`rounded-full border px-3 py-1 text-sm font-bold ${kind === k ? (k === "note" ? "border-amber bg-amber text-[var(--on-amber)]" : "border-violet bg-violet text-on-violet") : "border-line text-ink-2 hover:border-violet hover:text-ink"}`}>{l}</button>)}
              </div>
              <Composer key={kind} label={kind === "note" ? "Note for staff (the requester never sees it)" : kind === "resolve" ? "Closing message (asks the requester to confirm)" : "Message to the requester"} busy={busy} onSend={send} submitLabel={active[2]} />
            </div>
          ) : <p className="mt-6 text-sm text-ink-2">This request is closed.</p>}
        </div>
        <aside className="grid content-start gap-4">
          <div className="rounded-panel border border-line bg-surface p-4">
            <h2 className="font-display font-bold">Details</h2>
            <div className="mt-3 grid gap-3 text-sm">
              <label className="grid gap-1"><span className="text-muted">Priority</span><select className="field !min-h-9 !py-1" value={t.priority} disabled={busy} onChange={(e) => patch({ priority: e.target.value })}>{Object.entries(PRIORITY).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
              <label className="grid gap-1"><span className="text-muted">Topic</span><select className="field !min-h-9 !py-1" value={t.category} disabled={busy} onChange={(e) => patch({ category: e.target.value })}>{CATEGORIES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
              <label className="grid gap-1"><span className="text-muted">Assigned to</span><select className="field !min-h-9 !py-1" value={t.assignedTo?.id ?? ""} disabled={busy} onChange={(e) => patch({ assignedToId: e.target.value || null })}><option value="">Nobody</option>{(staff ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
              {isSuper && t.status !== "closed" ? <button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={() => patch({ status: "closed" })}>Close without confirmation</button> : null}
            </div>
          </div>
          <div className="rounded-panel border border-line bg-surface p-4 text-sm">
            <h2 className="font-display font-bold">Context</h2>
            <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1.5">
              <dt className="text-muted">Topic</dt><dd className="text-ink">{categoryLabel(t.category)}</dd>
              {t.course ? <><dt className="text-muted">Course</dt><dd><Link className="link" href={`/courses/${t.course.slug}`}>{t.course.title}</Link></dd></> : null}
              {t.order ? <><dt className="text-muted">Order</dt><dd><Link className="link" href={`/admin/orders?q=${t.order.id}`}>{moneyExact(t.order.totalCents)} · {t.order.status}</Link></dd></> : null}
              {(["browser", "os", "page", "screen", "language"] as const).map((k) => ctx[k] ? <Fragment key={k}><dt className="capitalize text-muted">{k}</dt><dd className="break-words text-ink">{String(ctx[k])}</dd></Fragment> : null)}
              <dt className="text-muted">App</dt><dd className="text-ink">{ctx.installedApp ? "Installed app" : "Browser"}</dd>
            </dl>
          </div>
        </aside>
      </div>
    </>
  );
}
