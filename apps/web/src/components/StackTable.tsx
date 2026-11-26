"use client";
import { useEffect, useRef } from "react";

/**
 * Phones (< 640 px): a wide table becomes one card per row, each value labelled with its column name, instead of a box
 * that scrolls sideways with hidden columns (mobile QA, owner 2026-11-26). Labels come from the table's own <th> text,
 * so any table works unchanged; the first cell is the card title. Wider screens keep the normal table.
 * CSS: `.stack-table` in app/globals.css.
 */
export function useStackLabels() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const label = () => {
      for (const table of root.querySelectorAll("table")) {
        const heads = [...table.querySelectorAll("thead th")].map((th) => (th.textContent ?? "").trim());
        for (const tr of table.querySelectorAll("tbody tr")) {
          let col = 0;
          for (const td of tr.children) {
            const name = heads[col] ?? "";
            if (td.getAttribute("data-label") !== name) td.setAttribute("data-label", name);
            col += Number((td as HTMLTableCellElement).colSpan || 1);
          }
        }
      }
    };
    label();
    const mo = new MutationObserver(label);
    mo.observe(root, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, []);
  return ref;
}

export function StackTable({ className = "", children }: { className?: string; children: React.ReactNode }) {
  const ref = useStackLabels();
  return <div ref={ref} className={`stack-table ${className}`}>{children}</div>;
}
