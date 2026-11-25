"use client";
import Link from "next/link";
import { use, useState } from "react";
import { ArrowLeft, CheckCircle2, Loader2, RotateCcw } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { Skeleton } from "@/components/Empty";
import { useToast } from "@/components/Toast";
import { Composer, StatusPill, Thread, categoryLabel, toTicket } from "@/components/support/shared";

export default function TicketPage({ params }: { params: Promise<{ number: string }> }) {
  const { number } = use(params);
  const toast = useToast();
  const { data: t, error, setData } = useApi(`/support/tickets/${encodeURIComponent(number)}`, toTicket);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  async function act(path: string, body?: object, ok?: string) {
    setBusy(true);
    try { setData(toTicket(await api(`/support/tickets/${t!.number}/${path}`, { method: "POST", body }))); if (ok) toast("ok", ok); return true; }
    catch (e) { toast("error", errMsg(e)); return false; } finally { setBusy(false); }
  }

  if (error) return <div className="container-x max-w-3xl py-10"><p className="text-rose">{error}</p><Link href="/support" className="link mt-3 inline-block">Back to Help and support</Link></div>;
  if (!t) return <div className="container-x max-w-3xl py-10"><Skeleton className="h-96" /></div>;
  return (
    <div className="container-x max-w-3xl pb-12 pt-8">
      <Link href="/support" className="link inline-flex items-center gap-1 text-sm"><ArrowLeft className="size-4" />Help and support</Link>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-[clamp(1.6rem,3vw,2.2rem)] font-extrabold leading-tight">{t.subject}</h1>
          <p className="mt-1 text-sm text-muted">{t.number} · {categoryLabel(t.category)}{t.course ? <> · <Link className="link" href={`/courses/${t.course.slug}`}>{t.course.title}</Link></> : null}</p>
        </div>
        <StatusPill status={t.status} />
      </div>

      {t.status === "resolved" ? (
        <div className="mt-5 flex flex-wrap items-center gap-3 rounded-tile border border-mint/40 bg-mint-soft px-4 py-3" data-testid="confirm-box">
          <CheckCircle2 className="size-5 text-mint" aria-hidden="true" />
          <p className="min-w-0 flex-1 text-sm text-ink">We marked this as resolved. Did it solve your problem? It closes by itself after 7 days.</p>
          <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => act("resolved", undefined, "Thanks for confirming.")} data-testid="confirm-resolved">Yes, it’s solved</button>
          <button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={() => act("still-need-help", undefined, "We’ll take another look.")}>I still need help</button>
        </div>
      ) : null}

      <div className="mt-6"><Thread messages={t.messages} viewerIsStaff={false} /></div>

      <div className="mt-6 rounded-panel border border-line bg-surface p-5">
        {t.status === "closed" ? (
          t.canReopen ? (
            <form className="grid gap-3" onSubmit={async (e) => { e.preventDefault(); if (await act("reopen", { note }, "Request reopened.")) setNote(""); }}>
              <label className="grid gap-1.5"><span className="label !mb-0">Still having this problem?</span>
                <textarea className="field" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Tell us what still needs help." maxLength={5000} />
              </label>
              <button className="btn btn-outline w-fit" disabled={busy || note.trim().length < 5}>{busy ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}Reopen request</button>
            </form>
          ) : <p className="text-sm text-ink-2">This request is closed. <Link href="/support/new" className="link">Open a new request</Link> if you need more help.</p>
        ) : (
          <Composer label={t.status === "waiting_user" ? "Your answer" : "Add a message"} busy={busy} submitLabel="Send"
            onSend={async (body, files) => act("messages", { body, attachments: files }, "Message sent.")} />
        )}
      </div>
    </div>
  );
}
