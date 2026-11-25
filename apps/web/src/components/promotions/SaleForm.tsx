"use client";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { moneyExact } from "@/lib/format";
import { useToast } from "@/components/Toast";
import { fromLocalInput, inDays, toLocalInput } from "./when";

export interface SaleDraft { id?: string; salePriceCents: number; startsAt: string; endsAt: string; status?: string }

const QUICK_OFF = [10, 20, 30, 50];
const QUICK_DAYS = [3, 7, 14, 31];

/**
 * Create or edit an instructor's sale. Mirrors the server rules so mistakes show before saving (at least 10% off,
 * not below the minimum price, up to 31 days); the server checks them again.
 */
export function SaleForm({ courseId, listCents, maxSaleCents, minCents, maxDays, sharePercent, who = "You receive", edit, onDone, onCancel }: {
  courseId: string; listCents: number; maxSaleCents: number; minCents: number; maxDays: number; sharePercent: number; who?: string;
  edit?: SaleDraft; onDone: () => void; onCancel: () => void;
}) {
  const toast = useToast();
  const running = edit?.status === "active";
  const [price, setPrice] = useState(((edit?.salePriceCents ?? Math.min(maxSaleCents, Math.round((listCents * 0.7) / 100) * 100 - 1)) / 100).toFixed(2));
  // The form's "now" is fixed when it opens; the server checks again on save.
  const [now] = useState(() => Date.now());
  const [startNow, setStartNow] = useState(!edit);
  const [start, setStart] = useState(() => toLocalInput(edit?.startsAt ?? inDays(1, new Date(now))));
  const [end, setEnd] = useState(() => toLocalInput(edit?.endsAt ?? inDays(7, new Date(now))));
  const [busy, setBusy] = useState(false);

  const cents = Math.round(Number(price) * 100);
  const startIso = running ? edit!.startsAt : startNow ? new Date(now).toISOString() : fromLocalInput(start);
  const endIso = fromLocalInput(end);
  const off = listCents > 0 && Number.isFinite(cents) ? Math.round(((listCents - cents) * 100) / listCents) : 0;
  const days = startIso && endIso ? (new Date(endIso).getTime() - new Date(startIso).getTime()) / 86400_000 : 0;
  const problem =
    !Number.isFinite(cents) || cents < minCents || cents > maxSaleCents ? `Sale price must be between ${moneyExact(minCents)} and ${moneyExact(maxSaleCents)} (at least 10% off).`
      : !startIso || !endIso ? "Pick when the sale starts and ends."
        : days <= 0 ? "The end must be after the start."
          : days > maxDays + 1 / 1440 ? `A sale can last up to ${maxDays} days.`
            : new Date(endIso).getTime() <= now ? "The end must be in the future." : null;
  // Same arithmetic as checkout: Stripe's standard US card fee, then the instructor's share.
  const fee = Math.round(cents * 0.029) + 30;
  const yours = Math.floor(((cents - fee) * sharePercent * 100 * 2 + 10000) / 20000);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (problem) return;
    setBusy(true);
    try {
      // "Start now" means the moment of saving.
      const body = { salePriceCents: cents, startsAt: startNow && !running ? new Date().toISOString() : startIso, endsAt: endIso };
      if (edit?.id) await api(`/instructor/courses/${courseId}/sales/${edit.id}`, { method: "PATCH", body });
      else await api(`/instructor/courses/${courseId}/sales`, { method: "POST", body });
      toast("ok", edit ? "Sale updated." : startNow ? "Your course is on sale now." : "Sale scheduled.");
      onDone();
    } catch (err) {
      toast("error", errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="mt-4 rounded-tile border border-line bg-paper p-4 sm:p-5" data-testid="sale-form">
      <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <div>
          <label className="label" htmlFor={`sp-${courseId}`}>Sale price</label>
          <div className="flex items-center gap-2">
            <span className="text-ink-2">$</span>
            <input id={`sp-${courseId}`} inputMode="decimal" className="field tabular-nums" value={price} onChange={(e) => setPrice(e.target.value)} aria-invalid={!!problem && problem.startsWith("Sale price")} />
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {QUICK_OFF.map((p) => {
              const c = Math.max(minCents, Math.min(maxSaleCents, Math.round((listCents * (100 - p)) / 100)));
              return (
                <button key={p} type="button" onClick={() => setPrice((c / 100).toFixed(2))} className="rounded-full border border-line px-2.5 py-0.5 text-xs font-bold text-ink-2 hover:border-violet hover:text-violet">−{p}%</button>
              );
            })}
          </div>
          <p className="hint">Regular price {moneyExact(listCents)}. {off > 0 ? `${off}% off.` : ""}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <span className="label">Starts</span>
            {running ? (
              <p className="py-2 text-sm text-ink-2">Already running</p>
            ) : (
              <>
                <label className="flex items-center gap-2 text-sm text-ink-2"><input type="checkbox" checked={startNow} onChange={(e) => setStartNow(e.target.checked)} className="size-4 accent-[var(--violet)]" />Start now</label>
                {!startNow ? <input type="datetime-local" aria-label="Start date and time" className="field mt-2" value={start} onChange={(e) => setStart(e.target.value)} /> : null}
              </>
            )}
          </div>
          <div>
            <label className="label" htmlFor={`se-${courseId}`}>Ends</label>
            <input id={`se-${courseId}`} type="datetime-local" className="field" value={end} onChange={(e) => setEnd(e.target.value)} />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {QUICK_DAYS.map((d) => (
                <button key={d} type="button" onClick={() => setEnd(toLocalInput(inDays(d, new Date(startIso ?? now))))} className="rounded-full border border-line px-2.5 py-0.5 text-xs font-bold text-ink-2 hover:border-violet hover:text-violet">{d} days</button>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        {problem ? <p className="text-sm font-bold text-rose" role="alert">{problem}</p> : (
          <p className="text-sm text-ink-2">Learners pay <b className="text-ink">{moneyExact(cents)}</b> instead of {moneyExact(listCents)}. {who} about <b className="text-ink">{moneyExact(Math.max(0, yours))}</b> per sale ({sharePercent}% after Stripe’s fee).</p>
        )}
        <div className="flex gap-2">
          <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>Close</button>
          <button className="btn btn-primary btn-sm" disabled={busy || !!problem} data-testid="save-sale">{busy ? <Loader2 className="size-4 animate-spin" /> : null}{edit ? "Save changes" : startNow ? "Start sale" : "Schedule sale"}</button>
        </div>
      </div>
    </form>
  );
}
