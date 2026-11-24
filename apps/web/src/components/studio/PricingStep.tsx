"use client";
import { useState } from "react";
import type { EditorCtx } from "./CourseEditor";
import { StepFooter } from "./CourseEditor";
import { moneyExact } from "@/lib/format";

const tiers = [0, 1999, 2999, 4999, 7999, 9999, 12999];

export function PricingStep({ course, patch, goto, locked }: EditorCtx) {
  const [cents, setCents] = useState(course.priceCents);
  const [raw, setRaw] = useState((course.priceCents / 100).toFixed(2));
  const [saving, setSaving] = useState(false);
  const save = async () => { setSaving(true); await patch({ priceCents: cents }, "Price saved."); setSaving(false); };
  return (
    <fieldset disabled={locked} className="max-w-3xl">
      <h2 className="font-display text-xl font-bold">Set your price</h2>
      <p className="mt-1 text-ink-2">Prices are in US dollars. The platform commission is set by the admin and shown on each sale in Sales.</p>
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
            onChange={(e) => { setRaw(e.target.value); const v = Math.round(Number(e.target.value) * 100); if (Number.isFinite(v) && v >= 0) setCents(v); }} />
        </div>
        <p className="hint">Free, or at least $9.99. Learners see {cents ? moneyExact(cents) : "Free"}.</p>
      </div>
      <StepFooter onSave={save} saving={saving} next="submit" goto={goto} disabled={locked} />
    </fieldset>
  );
}
