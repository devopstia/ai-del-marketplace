"use client";
import { useId, useState } from "react";
import { moneyExact } from "@/lib/format";

/** Same arithmetic as the API's checkout split (money.ts): Stripe's standard US card fee, then the share, rounded half up. */
function split(priceCents: number, sharePercent: number) {
  const fee = priceCents ? Math.min(priceCents, Math.round(priceCents * 0.029) + 30) : 0;
  const net = priceCents - fee;
  const yours = Math.floor((net * sharePercent * 100 * 2 + 10000) / 20000);
  return { fee, net, yours, platform: net - yours };
}

const PRESETS = [1999, 4999, 8999];

export function EarningsCalculator({ sharePercent, minCents, maxCents }: { sharePercent: number; minCents: number; maxCents: number }) {
  const id = useId();
  const [price, setPrice] = useState(4999);
  const [sales, setSales] = useState(20);
  const cents = Math.min(maxCents, Math.max(minCents, price));
  const s = split(cents, sharePercent);
  const month = s.yours * sales;
  const setDollars = (v: string) => {
    const n = Math.round(Number(v) * 100);
    if (Number.isFinite(n)) setPrice(n);
  };

  return (
    <div className="rounded-tile border border-line bg-paper p-5 sm:p-6">
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor={`${id}-price`} className="label">Course price</label>
          <div className="flex items-center gap-2">
            <span className="text-ink-2">$</span>
            <input
              id={`${id}-price`} type="number" inputMode="decimal" min={minCents / 100} max={maxCents / 100} step="0.01"
              value={(price / 100).toString()} onChange={(e) => setDollars(e.target.value)}
              className="field !min-h-10 tabular-nums"
            />
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <button key={p} type="button" onClick={() => setPrice(p)} aria-pressed={cents === p}
                className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${cents === p ? "border-violet bg-violet-soft text-violet" : "border-line text-ink-2 hover:border-violet"}`}>
                {moneyExact(p)}
              </button>
            ))}
          </div>
          {price !== cents ? <p className="hint">Paid courses are {moneyExact(minCents)} to {moneyExact(maxCents)}; showing {moneyExact(cents)}.</p> : null}
        </div>
        <div>
          <label htmlFor={`${id}-sales`} className="label">Sales per month: <span className="tabular-nums text-ink">{sales}</span></label>
          <input id={`${id}-sales`} type="range" min={1} max={200} value={sales} onChange={(e) => setSales(Number(e.target.value))} className="mt-3 w-full accent-[var(--violet)]" />
          <div className="flex justify-between text-xs text-muted"><span>1</span><span>200</span></div>
        </div>
      </div>

      <dl className="mt-6 space-y-2.5 border-t border-line pt-5 text-sm tabular-nums [&_dd]:whitespace-nowrap" aria-live="polite">
        <div className="flex justify-between gap-4"><dt className="text-ink-2">Learner pays</dt><dd>{moneyExact(cents)}</dd></div>
        <div className="flex justify-between gap-4"><dt className="text-ink-2">Stripe processing fee (2.9% + 30¢, US card)</dt><dd>−{moneyExact(s.fee)}</dd></div>
        <div className="flex justify-between gap-4 border-t border-line pt-2.5"><dt className="text-ink-2">Amount to split</dt><dd>{moneyExact(s.net)}</dd></div>
        <div className="flex justify-between gap-4"><dt className="text-ink-2">Platform ({100 - sharePercent}%)</dt><dd>{moneyExact(s.platform)}</dd></div>
        <div className="flex justify-between gap-4 border-t-2 border-ink pt-2.5 font-bold"><dt>You receive per sale ({sharePercent}%)</dt><dd>{moneyExact(s.yours)}</dd></div>
      </dl>
      <div className="mt-5 flex items-end justify-between gap-4 rounded-lg bg-surface px-4 py-3 ring-1 ring-line">
        <span className="text-sm text-ink-2">At {sales} {sales === 1 ? "sale" : "sales"} a month</span>
        <span className="font-display text-2xl font-extrabold tabular-nums text-ink">{moneyExact(month)}</span>
      </div>
      <p className="mt-3 text-xs text-muted">An estimate, not a promise of sales. Stripe’s fee depends on the card and country, and refunded sales pay nothing, so each sale’s exact amount is shown in your studio.</p>
    </div>
  );
}
