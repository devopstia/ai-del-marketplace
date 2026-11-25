"use client";
import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { Download, X } from "lucide-react";
import { promptInstall, usePwa } from "@/lib/pwa";

const KEY = "del-install-hint-dismissed";
const read = () => { try { return localStorage.getItem(KEY) === "1"; } catch { return false; } };
const noop = () => () => {};

/** One quiet row suggesting the installable app; hidden in the installed app and once dismissed. */
export function InstallHint() {
  const { canPrompt, installed } = usePwa();
  const dismissedStored = useSyncExternalStore(noop, read, () => true);
  const [dismissed, setDismissed] = useState(false);
  if (installed || dismissedStored || dismissed) return null;
  const close = () => { try { localStorage.setItem(KEY, "1"); } catch { /* fine: hidden for this visit */ } setDismissed(true); };
  return (
    <div className="mt-10 flex flex-wrap items-center gap-x-4 gap-y-3 rounded-tile border border-line bg-surface px-4 py-3" data-testid="install-hint">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icons/icon-192.png" alt="" className="size-10 rounded-xl" />
      <p className="min-w-0 flex-1 text-sm text-ink-2"><b className="text-ink">Take DEL with you.</b> Install the app on your phone or computer: its own icon, full screen, no app store.</p>
      <div className="flex items-center gap-2">
        {canPrompt ? <button type="button" className="btn btn-primary btn-sm" onClick={() => void promptInstall()}><Download className="size-4" />Install</button> : <Link href="/install" className="btn btn-outline btn-sm">How to install</Link>}
        <button type="button" className="btn btn-ghost btn-sm !px-2" aria-label="Hide this suggestion" onClick={close}><X className="size-4" /></button>
      </div>
    </div>
  );
}
