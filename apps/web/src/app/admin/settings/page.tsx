"use client";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { obj } from "@/lib/normalize";
import { moneyExact } from "@/lib/format";
import { PageHead } from "@/components/shell/AppShell";
import { Skeleton } from "@/components/Empty";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/components/AuthProvider";

export default function AdminSettings() {
  const toast = useToast();
  const { me } = useAuth();
  const canEdit = !!me?.roles.includes("super_admin");
  const [pct, setPct] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notify, setNotify] = useState<{ notify_new_registrations: boolean; notify_instructor_applications: boolean } | null>(null);
  useEffect(() => {
    api("/admin/settings").then((r) => {
      const o = obj(obj(r).settings ?? r);
      const bps = Number(o.commission_bps ?? o.commissionBps ?? obj(o.commission_bps).value ?? 0);
      setPct((bps / 100).toString());
      setNotify({ notify_new_registrations: o.notify_new_registrations === true, notify_instructor_applications: o.notify_instructor_applications !== false });
    }).catch(() => setPct("0"));
  }, []);
  const bps = Math.round(Number(pct) * 100);
  const valid = Number.isFinite(bps) && bps >= 0 && bps <= 10000;
  return (
    <>
      <PageHead title="Settings" sub="Platform-wide values. Changes apply to new orders only and are recorded in the audit log." />
      {pct === null ? <Skeleton className="h-60 max-w-2xl" /> : (
        <form className="max-w-2xl rounded-panel border border-line bg-surface p-6 sm:p-8" onSubmit={async (e) => {
          e.preventDefault();
          if (!valid) return;
          setBusy(true);
          try { await api("/admin/settings", { method: "PUT", body: { commission_bps: bps } }); toast("ok", "Commission saved."); }
          catch (err) { toast("error", errMsg(err)); } finally { setBusy(false); }
        }}>
          <h2 className="font-display text-xl font-bold">Platform commission</h2>
          <p className="mt-1 text-ink-2">The platform’s share of each independent instructor’s sale, taken from what’s left after Stripe’s processing fee. Applies to new sales; instructors with their own agreed rate (Instructors → Edit terms) and DEL’s own courses are not affected.</p>
          {!canEdit ? <p className="mt-3 rounded-lg bg-surface-2 px-3 py-2 text-sm text-ink-2">Only a super admin can change the commission.</p> : null}
          <label className="label mt-6" htmlFor="pct">Commission (%)</label>
          <div className="flex max-w-xs items-center gap-2">
            <input id="pct" inputMode="decimal" className="field tabular-nums" value={pct} onChange={(e) => setPct(e.target.value)} aria-invalid={!valid} disabled={!canEdit} />
            <span className="font-bold">%</span>
          </div>
          {!valid ? <p className="mt-1 text-sm text-rose">Enter a number between 0 and 100.</p> : (
            <p className="hint">On a {moneyExact(10000)} sale with a {moneyExact(320)} Stripe fee: {moneyExact(9680)} is split, the instructor receives {moneyExact(Math.floor((9680 * (10000 - bps) * 2 + 10000) / 20000))} and the platform {moneyExact(9680 - Math.floor((9680 * (10000 - bps) * 2 + 10000) / 20000))}.</p>
          )}
          <button className="btn btn-primary mt-6" disabled={busy || !valid || !canEdit}>{busy ? <Loader2 className="size-4 animate-spin" /> : null}Save commission</button>
        </form>
      )}
      {notify ? (
        <section className="mt-6 max-w-2xl rounded-panel border border-line bg-surface p-6 sm:p-8" aria-labelledby="notify-h">
          <h2 id="notify-h" className="font-display text-xl font-bold">Email notifications for super admins</h2>
          <p className="mt-1 text-ink-2">Optional emails to every super admin. Routine sign-ins never send email.</p>
          <ul className="mt-5 space-y-4">
            {([["notify_instructor_applications", "Instructor applications", "When a student applies or updates an application."], ["notify_new_registrations", "New registrations", "One email per new account. Off by default: busy days send many."]] as const).map(([k, l, d]) => (
              <li key={k}>
                <label className="flex gap-3">
                  <input type="checkbox" className="mt-1 size-4 accent-[var(--violet)]" disabled={!canEdit} checked={notify[k]} data-testid={k} onChange={async (e) => {
                    const v = e.target.checked;
                    setNotify({ ...notify, [k]: v });
                    try { await api("/admin/settings", { method: "PUT", body: { [k]: v } }); toast("ok", "Saved."); }
                    catch (err) { setNotify({ ...notify, [k]: !v }); toast("error", errMsg(err)); }
                  }} />
                  <span><span className="block font-bold text-ink">{l}</span><span className="text-sm text-ink-2">{d}</span></span>
                </label>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {canEdit ? <CompanyDetails /> : null}
    </>
  );
}

type Company = { legalName: string; address: string; supportEmail: string; website: string; taxId: string };
/** Company details printed on every receipt (docs/RECEIPTS.md). Empty fields are left off receipts, never invented. */
function CompanyDetails() {
  const toast = useToast();
  const [c, setC] = useState<Company | null>(null);
  const [defaults, setDefaults] = useState<Partial<Company>>({});
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api("/admin/settings/company").then((r) => {
      const o = obj(r);
      setC({ legalName: String(o.legalName ?? ""), address: String(o.address ?? ""), supportEmail: String(o.supportEmail ?? ""), website: String(o.website ?? ""), taxId: String(o.taxId ?? "") });
      setDefaults(obj(o.defaults) as Partial<Company>);
    }).catch(() => setC(null));
  }, []);
  if (!c) return null;
  const field = (k: keyof Company, label: string, hint: string, area = false) => (
    <div className="mt-4">
      <label className="label" htmlFor={`co-${k}`}>{label}</label>
      {area
        ? <textarea id={`co-${k}`} className="field min-h-24" value={c[k]} onChange={(e) => setC({ ...c, [k]: e.target.value })} placeholder={defaults[k] ?? ""} />
        : <input id={`co-${k}`} className="field" value={c[k]} onChange={(e) => setC({ ...c, [k]: e.target.value })} placeholder={defaults[k] ?? ""} />}
      <p className="hint">{hint}</p>
    </div>
  );
  return (
    <form className="mt-6 max-w-2xl rounded-panel border border-line bg-surface p-6 sm:p-8" data-testid="company-details" onSubmit={async (e) => {
      e.preventDefault();
      setBusy(true);
      try { await api("/admin/settings/company", { method: "PUT", body: c }); toast("ok", "Company details saved. New and existing receipts show them."); }
      catch (err) { toast("error", errMsg(err)); } finally { setBusy(false); }
    }}>
      <h2 className="font-display text-xl font-bold">Company details on receipts</h2>
      <p className="mt-1 text-ink-2">Printed in the “From” block of every receipt and its PDF. Leave a field empty to use the default shown, or to leave it off (address and tax ID).</p>
      {field("legalName", "Registered company name", `Default: ${defaults.legalName ?? "DevOps Easy Learning"}`)}
      {field("address", "Business address", "One line per row. Shown only when filled in.", true)}
      {field("supportEmail", "Support email", `Default: ${defaults.supportEmail ?? ""}`)}
      {field("website", "Website", `Default: ${defaults.website ?? ""}`)}
      {field("taxId", "Tax ID (optional)", "VAT or tax registration number, if you have one. Shown only when filled in.")}
      <button className="btn btn-primary mt-6" disabled={busy}>{busy ? <Loader2 className="size-4 animate-spin" /> : null}Save company details</button>
    </form>
  );
}
