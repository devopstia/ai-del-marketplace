"use client";
import Link from "next/link";
import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { obj } from "@/lib/normalize";
import { moneyExact } from "@/lib/format";
import { useToast } from "@/components/Toast";
import { CATEGORIES, Composer, browserContext } from "@/components/support/shared";

const arr = (x: unknown) => (Array.isArray(x) ? x : []);
const toCourses = (r: unknown) => arr(obj(r).items ?? r).map((x) => { const o = obj(obj(x).course ?? x); return { id: String(o.id), title: String(o.title) }; }).filter((c) => c.id !== "undefined");
const toOrders = (r: unknown) => arr(obj(r).items).map((x) => { const o = obj(x); return { id: String(o.id), label: `${new Date(String(o.createdAt)).toLocaleDateString("en-US", { dateStyle: "medium" })} · ${moneyExact(Number(o.totalCents ?? 0))}` }; });

function NewTicket() {
  const sp = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const { data: courses } = useApi("/me/learning", toCourses);
  const { data: orders } = useApi("/orders", toOrders);
  const [category, setCategory] = useState(sp.get("category") ?? (sp.get("order") ? "payments_refunds" : ""));
  const [subject, setSubject] = useState("");
  const [courseId, setCourseId] = useState(sp.get("course") ?? "");
  const [orderId, setOrderId] = useState(sp.get("order") ?? "");
  const [busy, setBusy] = useState(false);
  const from = sp.get("from");
  const ok = useMemo(() => !!category && subject.trim().length >= 5, [category, subject]);

  async function send(description: string, files: { key: string; name: string; mime: string; sizeBytes: number }[]) {
    if (!ok) { toast("error", "Pick a topic and write a subject of at least 5 characters."); return false; }
    setBusy(true);
    try {
      const r = obj(await api("/support/tickets", { method: "POST", body: { subject, category, description, courseId: courseId || null, orderId: orderId || null, context: browserContext(from), attachments: files } }));
      toast("ok", `Request ${r.number} sent. We’ll reply here and by email.`);
      router.push(`/support/${r.number}`);
      return true;
    } catch (e) { toast("error", errMsg(e)); return false; } finally { setBusy(false); }
  }

  return (
    <div className="container-x max-w-3xl pb-12 pt-8">
      <Link href="/support" className="link inline-flex items-center gap-1 text-sm"><ArrowLeft className="size-4" />Help and support</Link>
      <h1 className="mt-3 font-display text-[clamp(1.8rem,3.4vw,2.4rem)] font-extrabold leading-tight">New request</h1>
      <p className="mt-1 text-ink-2">Tell us what happened and what you expected. Screenshots help a lot.</p>
      <div className="mt-6 grid gap-4 rounded-panel border border-line bg-surface p-5 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1.5"><span className="label !mb-0">Topic</span>
            <select className="field" value={category} onChange={(e) => setCategory(e.target.value)} data-testid="ticket-category">
              <option value="">Choose a topic</option>
              {CATEGORIES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </label>
          <label className="grid gap-1.5"><span className="label !mb-0">Subject</span>
            <input className="field" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={160} placeholder="e.g. The video stops after two minutes" data-testid="ticket-subject" />
          </label>
          {courses?.length ? (
            <label className="grid gap-1.5"><span className="label !mb-0">Course (optional)</span>
              <select className="field" value={courseId} onChange={(e) => setCourseId(e.target.value)}><option value="">Not about a course</option>{courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</select>
            </label>
          ) : null}
          {orders?.length ? (
            <label className="grid gap-1.5"><span className="label !mb-0">Order (optional)</span>
              <select className="field" value={orderId} onChange={(e) => setOrderId(e.target.value)}><option value="">Not about an order</option>{orders.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</select>
            </label>
          ) : null}
        </div>
        <Composer label="What happened?" placeholder="The more detail, the faster we can help: what you did, what you saw, and what you expected." busy={busy} onSend={send} submitLabel="Send request" minRows={6} />
        <p className="text-xs text-muted">We include your browser and device type with the request so we can reproduce the problem.</p>
      </div>
    </div>
  );
}

export default function NewTicketPage() {
  return <Suspense><NewTicket /></Suspense>;
}
