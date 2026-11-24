"use client";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { compact } from "@/lib/format";

/** Server-side pagination footer for admin lists ({ page, pageSize, total } from the API). Hidden when everything fits on one page. */
export function Pager({ page, pageSize, total, onPage, noun = "results" }: { page: number; pageSize: number; total: number; onPage: (p: number) => void; noun?: string }) {
  const pages = Math.max(1, Math.ceil(total / Math.max(1, pageSize)));
  if (total <= pageSize && page === 1) return total ? <p className="mt-3 text-sm text-muted">{compact(total)} {noun}</p> : null;
  return (
    <nav aria-label="Pagination" className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm">
      <span className="text-muted">Page {page} of {pages} · {compact(total)} {noun}</span>
      <span className="flex gap-2">
        <button type="button" className="btn btn-outline btn-sm" disabled={page <= 1} onClick={() => onPage(page - 1)}><ChevronLeft className="size-4" />Previous</button>
        <button type="button" className="btn btn-outline btn-sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next<ChevronRight className="size-4" /></button>
      </span>
    </nav>
  );
}

/** A value that settles `ms` after the last change (search boxes that query the API). */
export function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}
