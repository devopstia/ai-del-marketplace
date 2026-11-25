"use client";
import { useEffect } from "react";
import { initInstallPrompt } from "@/lib/pwa";

/** Registers the offline-page service worker and listens for the browser's install prompt. Renders nothing. */
export function PwaRegister() {
  useEffect(() => {
    initInstallPrompt();
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => { /* the site works without it */ });
    }
  }, []);
  return null;
}
