"use client";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { obj } from "@/lib/normalize";
import { moneyExact } from "@/lib/format";
import { PageHead } from "@/components/shell/AppShell";
import { Skeleton } from "@/components/Empty";
import { useToast } from "@/components/Toast";

export default function AdminSettings() {
  const toast = useToast();
  const [pct, setPct] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api("/admin/settings").then((r) => {
      const o = obj(obj(r).settings ?? r);
      const bps = Number(o.commission_bps ?? o.commissionBps ?? obj(o.commission_bps).value ?? 0);
      setPct((bps / 100).toString());
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
          <p className="mt-1 text-ink-2">The share of each sale the platform keeps from independent instructors. Courses owned by the platform are not affected.</p>
          <label className="label mt-6" htmlFor="pct">Commission (%)</label>
          <div className="flex max-w-xs items-center gap-2">
            <input id="pct" inputMode="decimal" className="field tabular-nums" value={pct} onChange={(e) => setPct(e.target.value)} aria-invalid={!valid} />
            <span className="font-bold">%</span>
          </div>
          {!valid ? <p className="mt-1 text-sm text-rose">Enter a number between 0 and 100.</p> : (
            <p className="hint">On a {moneyExact(4999)} course: platform keeps {moneyExact(Math.round(4999 * bps / 10000))}, instructor receives {moneyExact(4999 - Math.round(4999 * bps / 10000))}.</p>
          )}
          <button className="btn btn-primary mt-6" disabled={busy || !valid}>{busy ? <Loader2 className="size-4 animate-spin" /> : null}Save commission</button>
        </form>
      )}
    </>
  );
}
