"use client";
import { useEffect, useMemo, useState } from "react";
import { CalendarClock, Check, CircleAlert, Gift, Loader2, Search, UserCheck, UserPlus, Wallet, X } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { obj } from "@/lib/normalize";
import { money } from "@/lib/format";
import { useDebounced } from "../Pager";
import { useToast } from "../Toast";

interface CourseOpt { id: string; title: string; priceCents: number; currency: string; instructor: { id: string; name: string } }
const plusMonths = (m: number) => { const d = new Date(); d.setMonth(d.getMonth() + m); return d.toISOString().slice(0, 10); };
const METHODS: [string, string][] = [["mobile_money", "Mobile money"], ["bank_transfer", "Bank transfer"], ["cash", "Cash"], ["paypal", "PayPal"], ["other", "Other"]];

/**
 * New manual enrollment (owner 2026-11-25). Instructors: their own courses, sent to DEL for approval. Super admin:
 * any courses, and the verified payment or a complimentary reason, activated at once (no second approval).
 */
export function EnrollmentForm({ mode, onDone }: { mode: "instructor" | "super_admin"; onDone: (id: string) => void }) {
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [student, setStudent] = useState<{ exists: boolean; name?: string; activeCourseIds?: string[]; suspended?: boolean } | null>(null);
  const [q, setQ] = useState("");
  const dq = useDebounced(q.trim());
  const [options, setOptions] = useState<CourseOpt[]>([]);
  const [picked, setPicked] = useState<(CourseOpt & { expiresAt: string })[]>([]);
  const [same, setSame] = useState(plusMonths(12));
  const [note, setNote] = useState("");
  const [pay, setPay] = useState<"payment" | "complimentary">("payment");
  const [reason, setReason] = useState("");
  const [p, setP] = useState({ method: "mobile_money", reference: "", currency: "USD", amount: "", usdRate: "1", fee: "0" });
  const [alloc, setAlloc] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const maxDate = plusMonths(mode === "instructor" ? 12 : 60);

  useEffect(() => {
    api(`/enrollments/manual/courses${dq ? `?q=${encodeURIComponent(dq)}` : ""}`).then((r) => setOptions((obj(r).items as CourseOpt[]) ?? [])).catch(() => setOptions([]));
  }, [dq]);
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- clear the lookup while the email is incomplete
    if (!validEmail) { setStudent(null); return; }
    const t = setTimeout(() => {
      api(`/enrollments/manual/lookup?email=${encodeURIComponent(email.trim())}`).then((r) => {
        const o = obj(r) as typeof student;
        setStudent(o);
        if (o?.exists && o.name) setName(o.name);
      }).catch(() => setStudent(null));
    }, 350);
    return () => clearTimeout(t);
  }, [email, validEmail]);

  const usdCents = useMemo(() => {
    const a = Number(p.amount), r = p.currency.toUpperCase() === "USD" ? 1 : Number(p.usdRate);
    return Number.isFinite(a) && Number.isFinite(r) ? Math.round(a * r * 100) : 0;
  }, [p.amount, p.usdRate, p.currency]);
  // Suggest an allocation in proportion to the courses' prices; the super admin can change every line.
  const suggest = () => {
    const total = picked.reduce((n, c) => n + c.priceCents, 0) || picked.length;
    let left = usdCents;
    const out: Record<string, string> = {};
    picked.forEach((c, i) => {
      const v = i === picked.length - 1 ? left : Math.round((usdCents * (total === picked.length ? 1 : c.priceCents)) / total);
      left -= v;
      out[c.id] = (v / 100).toFixed(2);
    });
    setAlloc(out);
  };
  const allocated = picked.reduce((n, c) => n + Math.round(Number(alloc[c.id] ?? 0) * 100), 0);
  const active = new Set(student?.activeCourseIds ?? []);

  function toggle(c: CourseOpt) {
    setPicked((x) => (x.some((y) => y.id === c.id) ? x.filter((y) => y.id !== c.id) : [...x, { ...c, expiresAt: same }]));
  }

  async function submit() {
    setErr(null);
    if (!validEmail || name.trim().length < 2 || !picked.length) { setErr("Enter the student’s email and name and choose at least one course."); return; }
    if (mode === "super_admin" && pay === "complimentary" && reason.trim().length < 5) { setErr("Say why this enrollment is complimentary."); return; }
    if (mode === "super_admin" && pay === "payment" && allocated !== usdCents) { setErr(`Share the payment between the courses: ${(allocated / 100).toFixed(2)} of ${(usdCents / 100).toFixed(2)} USD allocated.`); return; }
    setBusy(true);
    try {
      const body: Record<string, unknown> = {
        studentEmail: email.trim(), studentName: name.trim(), note: note.trim() || undefined,
        items: picked.map((c) => ({ courseId: c.id, expiresAt: c.expiresAt })),
      };
      if (mode === "super_admin") {
        if (pay === "complimentary") Object.assign(body, { complimentary: true, complimentaryReason: reason.trim() });
        else body.payment = { method: p.method, reference: p.reference.trim(), currency: p.currency.trim().toUpperCase(), amount: p.amount.trim(), usdRate: p.currency.toUpperCase() === "USD" ? "1" : p.usdRate.trim(), feeUsdCents: Math.round(Number(p.fee || 0) * 100), allocations: picked.map((c) => ({ courseId: c.id, grossUsdCents: Math.round(Number(alloc[c.id] ?? 0) * 100) })), verify: true };
      }
      const r = obj(await api("/enrollments/manual", { method: "POST", body }));
      toast("ok", mode === "instructor" ? `Request ${String(r.ref)} sent to DevOps Easy Learning.` : `${String(r.ref)}: courses activated${obj(r.student).hasAccount ? "" : " and invitation sent"}.`);
      onDone(String(r.id));
    } catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]" data-testid="enrollment-form">
      <div className="space-y-6">
        <section className="rounded-panel border border-line bg-surface p-5 sm:p-6" aria-labelledby="st-h">
          <h2 id="st-h" className="font-display text-lg font-bold">1. Student</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div><label className="label" htmlFor="me-email">Email address</label><input id="me-email" type="email" className="field" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="student@example.com" data-testid="me-email" /></div>
            <div><label className="label" htmlFor="me-name">Full name</label><input id="me-name" className="field" value={name} onChange={(e) => setName(e.target.value)} disabled={!!student?.exists} data-testid="me-name" /></div>
          </div>
          {student ? (
            student.exists ? (
              <p className={`mt-3 flex items-start gap-2 rounded-tile px-3 py-2 text-sm ${student.suspended ? "bg-rose-soft text-rose" : "bg-mint-soft text-ink"}`} data-testid="me-existing"><UserCheck className="mt-0.5 size-4 shrink-0 text-mint" /><span>{student.suspended ? "This account is suspended." : <><b>{student.name}</b> already has an account. The courses are added to it; no new account or password.</>}</span></p>
            ) : (
              <p className="mt-3 flex items-start gap-2 rounded-tile bg-cyan-soft px-3 py-2 text-sm text-ink" data-testid="me-new"><UserPlus className="mt-0.5 size-4 shrink-0 text-cyan-ink" /><span>New student. After approval they get an invitation by email, and you can copy the link to share it on WhatsApp or SMS. They set their own password; nobody else ever knows it.</span></p>
            )
          ) : null}
        </section>

        <section className="rounded-panel border border-line bg-surface p-5 sm:p-6" aria-labelledby="co-h">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 id="co-h" className="font-display text-lg font-bold">2. Courses</h2>
            <span className="relative w-full sm:w-64"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" /><input type="search" aria-label="Search courses" className="field !pl-9" placeholder={mode === "instructor" ? "Search your courses" : "Search all courses"} value={q} onChange={(e) => setQ(e.target.value)} /></span>
          </div>
          <ul className="mt-4 max-h-72 divide-y divide-line overflow-y-auto rounded-tile border border-line" role="listbox" aria-multiselectable="true" aria-label="Courses">
            {options.map((c) => {
              const on = picked.some((x) => x.id === c.id);
              const owned = active.has(c.id);
              return (
                <li key={c.id}>
                  <button type="button" role="option" aria-selected={on} disabled={owned} onClick={() => toggle(c)} data-testid="me-course"
                    className={`flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm ${on ? "bg-violet-soft" : "hover:bg-surface-2"} disabled:opacity-60`}>
                    <span className={`grid size-5 shrink-0 place-items-center rounded border ${on ? "border-violet bg-violet text-on-violet" : "border-line-strong"}`}>{on ? <Check className="size-3.5" strokeWidth={3} /> : null}</span>
                    <span className="min-w-0 flex-1"><span className="block truncate font-bold text-ink">{c.title}</span><span className="text-xs text-muted">{c.instructor.name}{owned ? " · already enrolled" : ""}</span></span>
                    <span className="tabular-nums text-ink-2">{money(c.priceCents, c.currency)}</span>
                  </button>
                </li>
              );
            })}
            {!options.length ? <li className="px-3 py-6 text-center text-sm text-muted">{mode === "instructor" ? "No published courses of yours match." : "No published courses match."}</li> : null}
          </ul>
        </section>

        {picked.length ? (
          <section className="rounded-panel border border-line bg-surface p-5 sm:p-6" aria-labelledby="ex-h">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div><h2 id="ex-h" className="font-display text-lg font-bold">3. Access until</h2><p className="text-sm text-ink-2">12 months by default, like every purchase.{mode === "instructor" ? " DEL can extend it later." : ""}</p></div>
              <div className="flex items-end gap-2">
                <div><label className="label" htmlFor="me-same">Same date for all</label><input id="me-same" type="date" className="field !w-auto" value={same} max={maxDate} onChange={(e) => setSame(e.target.value)} /></div>
                <button type="button" className="btn btn-outline btn-sm !min-h-11" onClick={() => setPicked((x) => x.map((c) => ({ ...c, expiresAt: same })))} data-testid="me-same-all">Apply to all</button>
              </div>
            </div>
            <ul className="mt-4 divide-y divide-line rounded-tile border border-line">
              {picked.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                  <CalendarClock className="size-4 shrink-0 text-violet" />
                  <span className="min-w-0 flex-1"><span className="block truncate font-bold">{c.title}</span><span className="text-xs text-muted">{c.instructor.name} · {money(c.priceCents, c.currency)}</span></span>
                  <input type="date" aria-label={`Access until for ${c.title}`} className="field !min-h-10 !w-auto" value={c.expiresAt} max={maxDate} onChange={(e) => setPicked((x) => x.map((y) => (y.id === c.id ? { ...y, expiresAt: e.target.value } : y)))} />
                  <button type="button" className="btn btn-ghost btn-sm !px-2" aria-label={`Remove ${c.title}`} onClick={() => toggle(c)}><X className="size-4" /></button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {mode === "super_admin" && picked.length ? (
          <section className="rounded-panel border border-line bg-surface p-5 sm:p-6" aria-labelledby="pay-h">
            <h2 id="pay-h" className="font-display text-lg font-bold">4. Payment</h2>
            <div role="radiogroup" aria-label="Payment" className="mt-3 flex flex-wrap gap-2">
              {([["payment", "External payment received", Wallet], ["complimentary", "Complimentary", Gift]] as const).map(([k, l, I]) => (
                <button key={k} type="button" role="radio" aria-checked={pay === k} onClick={() => setPay(k)} className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-bold ${pay === k ? "border-violet bg-violet-soft text-violet" : "border-line text-ink-2 hover:border-violet"}`}><I className="size-4" />{l}</button>
              ))}
            </div>
            {pay === "complimentary" ? (
              <div className="mt-4"><label className="label" htmlFor="me-reason">Why it is complimentary</label><input id="me-reason" className="field" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Scholarship, partner, staff training…" data-testid="me-reason" /></div>
            ) : (
              <div className="mt-4 space-y-4">
                <div className="grid gap-4 sm:grid-cols-3">
                  <div><label className="label" htmlFor="me-method">Method</label><select id="me-method" className="field" value={p.method} onChange={(e) => setP({ ...p, method: e.target.value })}>{METHODS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
                  <div className="sm:col-span-2"><label className="label" htmlFor="me-ref">Transaction reference</label><input id="me-ref" className="field" value={p.reference} onChange={(e) => setP({ ...p, reference: e.target.value })} placeholder="As shown on the bank or mobile money receipt" /></div>
                </div>
                <div className="grid gap-4 sm:grid-cols-4">
                  <div><label className="label" htmlFor="me-cur">Currency</label><input id="me-cur" className="field uppercase" maxLength={3} value={p.currency} onChange={(e) => setP({ ...p, currency: e.target.value.toUpperCase() })} /></div>
                  <div><label className="label" htmlFor="me-amt">Amount received</label><input id="me-amt" inputMode="decimal" className="field tabular-nums" value={p.amount} onChange={(e) => setP({ ...p, amount: e.target.value })} /></div>
                  <div><label className="label" htmlFor="me-rate">USD per 1 {p.currency || "unit"}</label><input id="me-rate" inputMode="decimal" className="field tabular-nums" disabled={p.currency.toUpperCase() === "USD"} value={p.currency.toUpperCase() === "USD" ? "1" : p.usdRate} onChange={(e) => setP({ ...p, usdRate: e.target.value })} /></div>
                  <div><label className="label" htmlFor="me-fee">Fees (USD)</label><input id="me-fee" inputMode="decimal" className="field tabular-nums" value={p.fee} onChange={(e) => setP({ ...p, fee: e.target.value })} /></div>
                </div>
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2"><p className="label !mb-0">Share between the courses (USD)</p><button type="button" className="btn btn-ghost btn-sm" onClick={suggest}>Split by course price</button></div>
                  <ul className="mt-2 space-y-2">
                    {picked.map((c) => (
                      <li key={c.id} className="flex items-center gap-3 text-sm"><span className="min-w-0 flex-1 truncate">{c.title}</span><input aria-label={`USD for ${c.title}`} inputMode="decimal" className="field !min-h-9 !w-28 tabular-nums" value={alloc[c.id] ?? ""} onChange={(e) => setAlloc({ ...alloc, [c.id]: e.target.value })} /></li>
                    ))}
                  </ul>
                  <p className={`mt-2 text-sm font-bold tabular-nums ${allocated === usdCents ? "text-mint" : "text-amber"}`}>{(allocated / 100).toFixed(2)} of {(usdCents / 100).toFixed(2)} USD allocated</p>
                </div>
                <p className="text-xs text-muted">Recording it here marks it verified by you. Only payments you have confirmed were received count; a screenshot alone is not proof. Instructor earnings are 80% of the net per course; payouts are recorded separately and never sent through Stripe.</p>
              </div>
            )}
          </section>
        ) : null}

        <section className="rounded-panel border border-line bg-surface p-5 sm:p-6">
          <label className="label" htmlFor="me-note">{mode === "instructor" ? "Note for DevOps Easy Learning (optional)" : "Internal note (optional)"}</label>
          <textarea id="me-note" className="field" rows={3} maxLength={4000} value={note} onChange={(e) => setNote(e.target.value)} placeholder={mode === "instructor" ? "How the student paid (method, reference, date), anything DEL should check." : "Kept with the record."} />
        </section>
      </div>

      <aside className="xl:sticky xl:top-20 xl:self-start">
        <div className="rounded-panel border border-line bg-surface p-5" aria-label="Review">
          <h2 className="font-display text-lg font-bold">Review</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div><dt className="text-muted">Student</dt><dd className="font-bold">{name || "—"}<span className="block font-normal text-ink-2">{email || "—"}</span></dd></div>
            <div><dt className="text-muted">Courses</dt><dd>{picked.length ? <ul className="mt-1 space-y-1">{picked.map((c) => <li key={c.id}><b>{c.title}</b> <span className="text-ink-2">until {c.expiresAt}</span></li>)}</ul> : "None yet"}</dd></div>
            {mode === "super_admin" ? <div><dt className="text-muted">Payment</dt><dd>{pay === "complimentary" ? "Complimentary" : usdCents ? `${p.amount} ${p.currency} = ${(usdCents / 100).toFixed(2)} USD` : "—"}</dd></div> : null}
          </dl>
          {err ? <p className="mt-3 flex gap-2 text-sm font-bold text-rose" role="alert"><CircleAlert className="mt-0.5 size-4 shrink-0" />{err}</p> : null}
          <button type="button" className="btn btn-primary mt-5 w-full" disabled={busy} onClick={submit} data-testid="me-submit">{busy ? <Loader2 className="size-4 animate-spin" /> : null}{mode === "instructor" ? "Send request to DEL" : "Enroll now"}</button>
          <p className="mt-2 text-xs text-muted">{mode === "instructor" ? "Access starts only after DEL verifies the payment and approves." : "Activates immediately. Recorded in the audit log."}</p>
        </div>
      </aside>
    </div>
  );
}
