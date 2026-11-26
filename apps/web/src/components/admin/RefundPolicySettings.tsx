"use client";
import { useEffect, useState } from "react";
import { History, Loader2, ShieldCheck } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { obj } from "@/lib/normalize";
import { date } from "@/lib/format";
import { pct } from "@/lib/refund-policy";
import { Skeleton } from "@/components/Empty";
import { useToast } from "@/components/Toast";

type R = Record<string, unknown>;
type Form = { windowDays: string; maxWatchedPercent: string; autoCheck: boolean; autoReject: boolean; autoApprove: boolean; allowExceptions: boolean; selfServicePerYear: string; submitted: string; approved: string; declined: string; processed: string; note: string };

const toForm = (c: R): Form => {
  const m = obj(c.messages);
  return {
    windowDays: String(c.windowDays ?? ""), maxWatchedPercent: String(c.maxWatchedPercent ?? ""), autoCheck: c.autoCheck !== false, autoReject: c.autoReject !== false, autoApprove: c.autoApprove !== false,
    allowExceptions: c.allowExceptions !== false, selfServicePerYear: String(c.selfServicePerYear ?? 3), submitted: String(m.submitted ?? ""), approved: String(m.approved ?? ""), declined: String(m.declined ?? ""), processed: String(m.processed ?? ""), note: "",
  };
};

function Switch({ id, label, hint, checked, disabled, onChange }: { id: string; label: string; hint: string; checked: boolean; disabled?: boolean; onChange: (v: boolean) => void }) {
  return (
    <label htmlFor={id} className={`flex items-start gap-3 rounded-tile border border-line px-4 py-3 ${disabled ? "opacity-60" : "cursor-pointer hover:border-violet"}`}>
      <input id={id} type="checkbox" className="mt-1 size-4 shrink-0 accent-[var(--violet)]" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span><span className="block font-bold">{label}</span><span className="block text-sm text-ink-2">{hint}</span></span>
    </label>
  );
}

/**
 * Super Admin › Refunds › Policy (owner 2026-11-26): the platform-wide refund rules, saved as a new version (earlier
 * versions stay with their dates; each purchase keeps the version it was bought under). Needs an authenticator code.
 */
export function RefundPolicySettings({ canEdit }: { canEdit: boolean }) {
  const toast = useToast();
  const { data, error, reload } = useApi("/admin/refund-policy", (r) => obj(r));
  const [f, setF] = useState<Form | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const current = obj(data?.current);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (data && !f) setF(toForm(current)); }, [data, f, current]);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => (x ? { ...x, [k]: v } : x));
  const versions = Array.isArray(data?.items) ? (data.items as R[]) : [];

  async function save() {
    if (!f) return;
    setBusy(true);
    try {
      const body = {
        windowDays: Number(f.windowDays), maxWatchedPercent: Number(f.maxWatchedPercent), autoCheck: f.autoCheck, autoReject: f.autoCheck && f.autoReject, autoApprove: f.autoCheck && f.autoApprove,
        allowExceptions: f.allowExceptions, selfServicePerYear: Number(f.selfServicePerYear),
        messages: { submitted: f.submitted.trim() || undefined, approved: f.approved.trim() || undefined, declined: f.declined.trim() || undefined, processed: f.processed.trim() || undefined },
        note: f.note.trim() || undefined, code: code.trim() || undefined,
      };
      const r = obj(await api("/admin/refund-policy", { method: "PUT", body }));
      toast("ok", `Saved as version ${String(obj(r.current).version)}. New purchases use it from now on; earlier purchases keep their version.`);
      setF(null); setCode(""); setConfirm(false); reload();
    } catch (e) { toast("error", errMsg(e)); } finally { setBusy(false); }
  }

  if (error) return <p className="text-rose">{error}</p>;
  if (!data || !f) return <Skeleton className="h-96" />;
  const days = Number(f.windowDays), limit = Number(f.maxWatchedPercent);
  const valid = Number.isInteger(days) && days >= 1 && days <= 365 && limit >= 0 && limit <= 100 && Math.round(limit * 10) === limit * 10 && Number.isInteger(Number(f.selfServicePerYear)) && Number(f.selfServicePerYear) >= 0;
  const changed = JSON.stringify({ ...toForm(current), note: "" }) !== JSON.stringify({ ...f, note: "" });

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]" data-testid="refund-policy">
      <form className="rounded-panel border border-line bg-surface p-5" onSubmit={(e) => { e.preventDefault(); setConfirm(true); }}>
        <h2 className="font-display text-lg font-bold">Refund rules</h2>
        <p className="mt-1 text-sm text-ink-2">In force: version {String(current.version)}{current.effectiveFrom && Number(current.version) > 1 ? ` since ${date(String(current.effectiveFrom))}` : ""}. Saving creates a new version for purchases from now on; nothing changes for earlier purchases unless the new rules are more generous.</p>
        <fieldset disabled={!canEdit} className="mt-5 grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label" htmlFor="rp-days">Refund period (days)</label>
            <input id="rp-days" className="field" type="number" min={1} max={365} step={1} inputMode="numeric" value={f.windowDays} onChange={(e) => set("windowDays", e.target.value)} data-testid="rp-days" />
            <p className="mt-1 text-xs text-muted">From payment, to the minute. Often 7, 14 or 30.</p>
          </div>
          <div>
            <label className="label" htmlFor="rp-limit">Maximum watched (%)</label>
            <input id="rp-limit" className="field" type="number" min={0} max={100} step={0.1} inputMode="decimal" value={f.maxWatchedPercent} onChange={(e) => set("maxWatchedPercent", e.target.value)} data-testid="rp-limit" />
            <p className="mt-1 text-xs text-muted">Unique paid video; exactly this value still qualifies.</p>
          </div>
          <div>
            <label className="label" htmlFor="rp-year">Automatic refunds per student a year</label>
            <input id="rp-year" className="field" type="number" min={0} max={100} step={1} inputMode="numeric" value={f.selfServicePerYear} onChange={(e) => set("selfServicePerYear", e.target.value)} />
            <p className="mt-1 text-xs text-muted">Beyond this, a person approves.</p>
          </div>
        </fieldset>
        <fieldset disabled={!canEdit} className="mt-5 grid gap-2">
          <legend className="mb-2 font-bold">How requests are handled</legend>
          <Switch id="rp-check" label="Check eligibility automatically" hint="Decide from the purchase date and the measured watch share. Off: every request waits for a person." checked={f.autoCheck} onChange={(v) => setF((x) => (x ? { ...x, autoCheck: v, ...(v ? {} : { autoApprove: false, autoReject: false }) } : x))} />
          <Switch id="rp-approve" label="Refund eligible requests at once" hint="Off: eligible requests wait for manual approval." checked={f.autoCheck && f.autoApprove} disabled={!f.autoCheck} onChange={(v) => set("autoApprove", v)} />
          <Switch id="rp-reject" label="Decline ineligible requests at once" hint="The student sees the exact reasons and can ask for a human review. Off: a person decides." checked={f.autoCheck && f.autoReject} disabled={!f.autoCheck} onChange={(v) => set("autoReject", v)} />
          <Switch id="rp-exceptions" label="Allow exceptions" hint="A Super Admin may approve a declined request with a documented reason (duplicate payment, technical problem, legal right)." checked={f.allowExceptions} onChange={(v) => set("allowExceptions", v)} />
        </fieldset>
        <fieldset disabled={!canEdit} className="mt-5">
          <legend className="font-bold">Extra text in notifications <span className="font-normal text-muted">(optional)</span></legend>
          <p className="mt-1 text-sm text-ink-2">Added as a short paragraph to the email. The decision, dates and numbers are always included.</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {([["submitted", "Request received"], ["approved", "Refund approved"], ["declined", "Request declined"], ["processed", "Refund completed"]] as const).map(([k, l]) => (
              <div key={k}>
                <label className="label" htmlFor={`rp-msg-${k}`}>{l}</label>
                <textarea id={`rp-msg-${k}`} className="field min-h-20" maxLength={1000} value={f[k]} onChange={(e) => set(k, e.target.value)} />
              </div>
            ))}
          </div>
        </fieldset>
        {canEdit ? (
          <div className="mt-5 border-t border-line pt-5">
            <label className="label" htmlFor="rp-note">Reason for the change (kept in the audit log)</label>
            <input id="rp-note" className="field" maxLength={500} value={f.note} onChange={(e) => set("note", e.target.value)} />
            {!valid ? <p role="alert" className="mt-2 text-sm text-rose">Use 1–365 days, 0–100 % with at most one decimal, and a whole number of automatic refunds.</p> : null}
            {confirm ? (
              <div className="mt-4 rounded-tile border border-violet bg-surface-2 p-4" role="alert">
                <p className="font-bold">Save {days} days and {pct(limit)} as a new policy version?</p>
                <p className="mt-1 text-sm text-ink-2">Purchases from now on use it. Enter the code from your Google Authenticator app to confirm.</p>
                <div className="mt-3 flex flex-wrap items-end gap-2">
                  <div><label className="label" htmlFor="rp-code">Authenticator code</label><input id="rp-code" className="field w-40" inputMode="numeric" autoComplete="one-time-code" maxLength={12} value={code} onChange={(e) => setCode(e.target.value)} data-testid="rp-code" /></div>
                  <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void save()} data-testid="rp-save">{busy ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}Save version</button>
                  <button type="button" className="btn btn-ghost" onClick={() => setConfirm(false)}>Cancel</button>
                </div>
              </div>
            ) : (
              <div className="mt-4 flex flex-wrap justify-end gap-2">
                <button type="button" className="btn btn-ghost" disabled={!changed} onClick={() => setF(toForm(current))}>Reset</button>
                <button type="submit" className="btn btn-primary" disabled={!valid || !changed} data-testid="rp-review">Review and save</button>
              </div>
            )}
          </div>
        ) : <p className="mt-5 text-sm text-muted">Only a Super Admin can change the refund policy.</p>}
      </form>
      <section className="h-fit rounded-panel border border-line bg-surface p-5" aria-labelledby="rp-versions">
        <h2 id="rp-versions" className="flex items-center gap-2 font-display text-lg font-bold"><History className="size-5 text-violet" aria-hidden="true" />Versions</h2>
        <ol className="mt-3 divide-y divide-line text-sm" data-testid="rp-version-list">
          {versions.map((v) => (
            <li key={String(v.id)} className="py-3">
              <p className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-bold">Version {String(v.version)}{v.inForce ? <span className="ml-2 rounded-full bg-mint-soft px-2 py-0.5 text-xs font-bold text-mint">In force</span> : null}</span>
                <span className="tabular-nums text-ink-2">{String(v.windowDays)} days · {pct(Number(v.maxWatchedPercent))}</span>
              </p>
              <p className="mt-0.5 text-muted">{Number(v.version) === 1 ? "From launch" : `From ${date(String(v.effectiveFrom))}`}{v.effectiveUntil ? ` to ${date(String(v.effectiveUntil))}` : ""} · {String(v.orders ?? 0)} purchases{v.createdBy ? ` · by ${String(v.createdBy)}` : ""}</p>
              <p className="mt-0.5 text-muted">{v.autoCheck ? `Automatic checks; ${v.autoApprove ? "eligible refunded at once" : "manual approval"}; ${v.autoReject ? "ineligible declined at once" : "ineligible reviewed by a person"}` : "Every request reviewed by a person"}{v.allowExceptions ? "; exceptions allowed" : ""}</p>
              {v.note ? <p className="mt-0.5 text-ink-2">“{String(v.note)}”</p> : null}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
