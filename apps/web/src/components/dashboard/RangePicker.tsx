"use client";
import { useState } from "react";

export type RangeKey = "today" | "7d" | "30d" | "90d" | "month" | "year" | "custom";
export interface RangeValue { range: RangeKey; from?: string; to?: string }
export const RANGES: [RangeKey, string][] = [["today", "Today"], ["7d", "7 days"], ["30d", "30 days"], ["90d", "90 days"], ["month", "This month"], ["year", "This year"], ["custom", "Custom"]];
export const rangeLabel = (v: RangeValue) => (v.range === "custom" && v.from && v.to ? `${v.from} to ${v.to}` : RANGES.find((r) => r[0] === v.range)?.[1] ?? "30 days");

/** Date range for every figure on a dashboard. Custom opens two date inputs and applies on "Apply". */
export function RangePicker({ value, onChange }: { value: RangeValue; onChange: (v: RangeValue) => void }) {
  const [from, setFrom] = useState(value.from ?? "");
  const [to, setTo] = useState(value.to ?? "");
  const [custom, setCustom] = useState(value.range === "custom");
  return (
    <div className="flex max-w-full flex-wrap items-center gap-2">
      <div role="group" aria-label="Date range" className="flex max-w-full overflow-x-auto rounded-control border border-line bg-surface" data-testid="range-picker">
        {RANGES.map(([k, l]) => {
          const on = k === "custom" ? custom : !custom && value.range === k;
          return (
            <button key={k} type="button" aria-pressed={on} onClick={() => { if (k === "custom") setCustom(true); else { setCustom(false); onChange({ range: k }); } }}
              className={`shrink-0 whitespace-nowrap px-3 py-2 text-sm font-bold transition-colors ${on ? "bg-ink text-paper" : "text-muted hover:text-ink"}`}>
              {l}
            </button>
          );
        })}
      </div>
      {custom ? (
        <form className="flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); if (from && to) onChange({ range: "custom", from, to }); }}>
          <label className="sr-only" htmlFor="range-from">From</label>
          <input id="range-from" type="date" className="field !min-h-9 !w-auto !py-1 text-sm" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} required />
          <span className="text-sm text-muted">to</span>
          <label className="sr-only" htmlFor="range-to">To</label>
          <input id="range-to" type="date" className="field !min-h-9 !w-auto !py-1 text-sm" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} required />
          <button type="submit" className="btn btn-outline btn-sm">Apply</button>
        </form>
      ) : null}
    </div>
  );
}
