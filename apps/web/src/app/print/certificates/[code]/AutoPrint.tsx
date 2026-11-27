"use client";
import { useEffect } from "react";

/** Opens the print dialog once the certificate image has loaded. */
export function AutoPrint() {
  useEffect(() => {
    const img = document.getElementById("cert") as HTMLImageElement | null;
    const go = () => window.setTimeout(() => window.print(), 150);
    if (!img) return;
    if (img.complete && img.naturalWidth) go();
    else img.addEventListener("load", go, { once: true });
  }, []);
  return null;
}
