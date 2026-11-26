"use client";
import { useEffect } from "react";

/**
 * Phone menus, drawers and dialogs (mobile QA 2026-11-26): Esc closes them and the page behind doesn't scroll while
 * they are open. Restores the previous overflow when closed or unmounted.
 */
export function useOverlay(open: boolean, close: () => void) {
  useEffect(() => {
    if (!open) return;
    const html = document.documentElement;
    const before = html.style.overflow;
    html.style.overflow = "hidden";
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", esc);
    return () => { html.style.overflow = before; document.removeEventListener("keydown", esc); };
  }, [open, close]);
}
