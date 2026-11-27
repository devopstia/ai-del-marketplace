"use client";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";

export interface Column<T> { key: string; label: string; num?: boolean; sort?: (row: T) => number | string; render: (row: T) => React.ReactNode; className?: string }

/**
 * Sortable, searchable table for dashboards (Option A). Wide tables scroll sideways inside their own box on phones,
 * never the page. Click a header (or press Enter on it) to sort; click again to reverse.
 */
export function DataTable<T>({ rows, columns, rowKey, search, initialSort, empty, minWidth = 760, label }: {
  rows: T[]; columns: Column<T>[]; rowKey: (r: T) => string; search?: { placeholder: string; text: (r: T) => string };
  initialSort?: { key: string; dir: 1 | -1 }; empty?: React.ReactNode; minWidth?: number; label: string;
}) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState(initialSort ?? null);
  const shown = useMemo(() => {
    let out = search && q ? rows.filter((r) => search.text(r).toLowerCase().includes(q.toLowerCase())) : rows;
    const col = sort ? columns.find((c) => c.key === sort.key) : undefined;
    if (col?.sort && sort) out = [...out].sort((a, b) => { const x = col.sort!(a), y = col.sort!(b); return (x > y ? 1 : x < y ? -1 : 0) * sort.dir; });
    return out;
  }, [rows, columns, q, sort, search]);
  return (
    <div className="min-w-0">
      {search ? (
        <label className="relative mb-3 block max-w-xs">
          <span className="sr-only">{search.placeholder}</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input type="search" className="field !min-h-9 !py-1.5 !pl-9 text-sm" placeholder={search.placeholder} value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
      ) : null}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm" style={{ minWidth }} aria-label={label}>
          <thead className="border-b border-line text-muted">
            <tr>
              {columns.map((c) => {
                const on = sort?.key === c.key;
                return (
                  <th key={c.key} scope="col" aria-sort={on ? (sort!.dir === 1 ? "ascending" : "descending") : undefined} className={`whitespace-nowrap px-3 py-2.5 text-xs font-bold ${c.num ? "text-right" : ""}`}>
                    {c.sort ? (
                      <button type="button" className="font-bold hover:text-ink" onClick={() => setSort(on ? { key: c.key, dir: (sort!.dir * -1) as 1 | -1 } : { key: c.key, dir: c.num ? -1 : 1 })}>
                        {c.label}{on ? (sort!.dir === 1 ? " ↑" : " ↓") : ""}
                      </button>
                    ) : c.label}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {shown.map((r) => (
              <tr key={rowKey(r)} className="hover:bg-surface-2/50">
                {columns.map((c) => <td key={c.key} className={`px-3 py-2.5 align-middle ${c.num ? "whitespace-nowrap text-right tabular-nums" : ""} ${c.className ?? ""}`}>{c.render(r)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!shown.length ? <div className="mt-3">{empty ?? <p className="text-sm text-muted">Nothing matches “{q}”.</p>}</div> : null}
    </div>
  );
}
