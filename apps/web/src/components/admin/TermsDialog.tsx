"use client";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import type { AdminInstructor } from "@/lib/types";
import { Modal } from "../Modal";
import { useToast } from "../Toast";

/**
 * Super admin: the instructor type (Official DEL Instructor or independent), their agreed revenue share and the "pay to DEL"
 * agreement. Applies to new sales; audited. Official = branding only: their own rate and their own Stripe payouts still apply.
 */
export function TermsDialog({ i, defaultSharePercent, onClose, onSaved }: { i: AdminInstructor | null; defaultSharePercent: number; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [custom, setCustom] = useState(i?.commissionBps != null);
  const [share, setShare] = useState(i?.commissionBps != null ? String((10000 - i.commissionBps) / 100) : String(defaultSharePercent));
  const [payDel, setPayDel] = useState(!!i?.payToPlatform);
  const [official, setOfficial] = useState(!!i?.official);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const pct = Number(share);
  const valid = !custom || (Number.isFinite(pct) && pct >= 0 && pct <= 100);
  return (
    <Modal open={!!i} onClose={onClose} title={`Terms for ${i?.name ?? ""}`}>
      {i ? (
        <form className="space-y-5 p-5" onSubmit={async (e) => {
          e.preventDefault();
          if (!valid || note.trim().length < 5) return;
          setBusy(true);
          try {
            await api(`/admin/instructors/${i.userId}/terms`, { method: "PUT", body: { commissionBps: custom ? Math.round((100 - pct) * 100) : null, payToPlatform: payDel, official, note: note.trim() } });
            toast("ok", "Terms saved. They apply to new sales.");
            onSaved();
          } catch (err) { toast("error", errMsg(err)); } finally { setBusy(false); }
        }}>
          <fieldset>
            <legend className="label">Instructor type</legend>
            <label className="mt-2 flex items-start gap-2.5 text-sm"><input type="radio" name="kind" className="mt-0.5" checked={!official} onChange={() => setOfficial(false)} /><span><b>Independent instructor.</b> Courses are shown under their own name.</span></label>
            <label className="mt-2 flex items-start gap-2.5 text-sm"><input type="radio" name="kind" className="mt-0.5" checked={official} onChange={() => setOfficial(true)} data-testid="official-instructor" /><span><b>Official DevOps Easy Learning Instructor.</b> Courses are shown under the DevOps Easy Learning brand, with “Taught by {i.name}”. They still earn their share below through their own Stripe account.</span></label>
          </fieldset>
          <fieldset>
            <legend className="label">Revenue share</legend>
            <label className="mt-2 flex items-center gap-2 text-sm"><input type="radio" name="rate" checked={!custom} onChange={() => setCustom(false)} />Standard: instructor keeps {defaultSharePercent}% after Stripe’s fee</label>
            <label className="mt-2 flex items-center gap-2 text-sm"><input type="radio" name="rate" checked={custom} onChange={() => setCustom(true)} />Agreed rate</label>
            {custom ? (
              <div className="ml-6 mt-2 flex max-w-xs items-center gap-2">
                <input aria-label="Instructor keeps (%)" inputMode="decimal" className="field tabular-nums" value={share} onChange={(e) => setShare(e.target.value)} aria-invalid={!valid} />
                <span className="shrink-0 text-sm">% to the instructor</span>
              </div>
            ) : null}
            {!valid ? <p className="ml-6 mt-1 text-sm text-rose">Enter a number between 0 and 100.</p> : null}
          </fieldset>
          <label className="flex items-start gap-2.5 text-sm">
            <input type="checkbox" className="mt-0.5" checked={payDel} onChange={(e) => setPayDel(e.target.checked)} />
            <span><b>Pay this instructor’s share to DEL.</b> Only with the instructor’s written agreement. Their share is recorded but not transferred through Stripe; DEL settles with them directly.</span>
          </label>
          <div>
            <label className="label" htmlFor="terms-note">Reason or agreement reference (kept in the audit log)</label>
            <input id="terms-note" className="field" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Partner agreement signed 2026-11-20" required minLength={5} />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" disabled={busy || !valid || note.trim().length < 5} data-testid="save-terms">{busy ? <Loader2 className="size-4 animate-spin" /> : null}Save terms</button>
          </div>
        </form>
      ) : null}
    </Modal>
  );
}
