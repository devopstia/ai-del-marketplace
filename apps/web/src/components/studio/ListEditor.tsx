"use client";
import { Plus, X } from "lucide-react";

export function ListEditor({ id, label, hint, items, onChange, placeholder, min = 0 }: { id: string; label: string; hint?: string; items: string[]; onChange: (v: string[]) => void; placeholder: string; min?: number }) {
  const rows = items.length ? items : [""];
  return (
    <fieldset>
      <legend className="label">{label}</legend>
      {hint ? <p className="hint !mt-0 mb-2">{hint}</p> : null}
      <ul className="space-y-2">
        {rows.map((v, i) => (
          <li key={i} className="flex gap-2">
            <input id={i === 0 ? id : undefined} aria-label={`${label} ${i + 1}`} className="field" value={v} maxLength={160} placeholder={placeholder}
              onChange={(e) => onChange(rows.map((x, j) => (j === i ? e.target.value : x)))} />
            <button type="button" className="btn btn-ghost btn-sm !px-2" aria-label={`Remove ${label.toLowerCase()} ${i + 1}`} disabled={rows.length <= Math.max(1, min)}
              onClick={() => onChange(rows.filter((_, j) => j !== i))}><X className="size-4" /></button>
          </li>
        ))}
      </ul>
      <button type="button" className="btn btn-ghost btn-sm mt-2 text-violet" onClick={() => onChange([...rows, ""])}><Plus className="size-4" />Add another</button>
    </fieldset>
  );
}
