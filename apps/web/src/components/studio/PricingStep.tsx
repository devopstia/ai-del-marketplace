"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { obj } from "@/lib/normalize";
import type { EditorCtx } from "./CourseEditor";
import { StepFooter } from "./CourseEditor";
import { moneyExact } from "@/lib/format";

const tiers = [0, 1999, 2999, 4999, 7999, 9999, 12999];

export function PricingStep({ course, patch, goto, locked }: EditorCtx) {
  const [cents, setCents] = useState(course.priceCents);
  const [raw, setRaw] = useState((course.priceCents / 100).toFixed(2));
  const [saving, setSaving] = useState(false);
  // Limits come from the API (GET /platform/terms); these defaults match it if the call fails.
  const [limits, setLimits] = useState({ minCents: 499, maxCents: 99999 });
  useEffect(() => {
    api("/platform/terms").then((t) => {
      const p = obj(obj(t).pricing);
      if (typeof p.minCents === "number" && typeof p.maxCents === "number") setLimits({ minCents: p.minCents, maxCents: p.maxCents });
    }).catch(() => {});
  }, []);
  const parsed = raw.trim() === "" ? NaN : Number(raw.trim());
  const error = !Number.isFinite(parsed) || parsed < 0
    ? "Enter a price in dollars, for example 49.99, or 0 for a free course."
    : cents !== 0 && (cents < limits.minCents || cents > limits.maxCents)
      ? `Paid courses cost between ${moneyExact(limits.minCents)} and ${moneyExact(limits.maxCents)}.`
      : null;
  const save = async () => {
    if (error) return false;
    setSaving(true);
    const ok = await patch({ priceCents: cents }, "Price saved.");
    setSaving(false);
    return ok;
  };
  return (
    <fieldset disabled={locked} className="max-w-3xl">
      <h2 className="font-display text-xl font-bold">Set your price</h2>
      <p className="mt-1 text-ink-2">Prices are in US dollars. You earn your share of each sale after Stripe’s processing fee; Sales shows every sale’s numbers.</p>
      <div className="mt-6 flex flex-wrap gap-2" role="radiogroup" aria-label="Suggested prices">
        {tiers.map((t) => (
          <button key={t} type="button" role="radio" aria-checked={cents === t} onClick={() => { setCents(t); setRaw((t / 100).toFixed(2)); }}
            className={`rounded-full border-[1.5px] px-4 py-2 text-sm font-bold ${cents === t ? "border-violet bg-violet-soft text-violet" : "border-line hover:border-line-strong"}`}>
            {t ? moneyExact(t) : "Free"}
          </button>
        ))}
      </div>
      <div className="mt-6 max-w-xs">
        <label className="label" htmlFor="price">Custom price (USD)</label>
        <div className="relative">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted">$</span>
          <input id="price" inputMode="decimal" className="field pl-7 tabular-nums" value={raw}
            aria-invalid={!!error} aria-describedby="price-hint"
            onChange={(e) => { setRaw(e.target.value); const v = Math.round(Number(e.target.value) * 100); if (e.target.value.trim() !== "" && Number.isFinite(v) && v >= 0) setCents(v); }} />
        </div>
        {error
          ? <p id="price-hint" className="hint !text-rose" role="alert">{error}</p>
          : <p id="price-hint" className="hint">Free, or {moneyExact(limits.minCents)} to {moneyExact(limits.maxCents)}. Learners see {cents ? moneyExact(cents) : "Free"}.</p>}
      </div>
      <StepFooter onSave={save} saving={saving} blocked={!!error} next="submit" goto={goto} disabled={locked} />
    </fieldset>
  );
}
