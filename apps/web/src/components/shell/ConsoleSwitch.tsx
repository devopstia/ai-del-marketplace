"use client";
import { useState } from "react";
import { ArrowLeftRight, Loader2 } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { useAuth } from "../AuthProvider";
import { useToast } from "../Toast";

/**
 * Super admins switch between the admin console (the whole marketplace) and "DEL Studio" (the instructor studio for
 * DEL's own courses, sales and students). The API records every studio action against the real person.
 */
export function ConsoleSwitch({ to }: { to: "del" | "admin" }) {
  const { me } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  if (!me?.roles.includes("super_admin")) return null;
  async function go() {
    setBusy(true);
    try {
      await api("/auth/act-as", { method: "POST", body: { mode: to === "del" ? "del" : "self" } });
      // full navigation: the studio/admin data must be fetched again under the new mode
      window.location.assign(to === "del" ? "/studio" : "/admin");
    } catch (e) { toast("error", errMsg(e)); setBusy(false); }
  }
  return (
    <button type="button" onClick={go} disabled={busy} data-testid={to === "del" ? "open-del-studio" : "back-to-admin"}
      className="mb-2 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[0.93rem] font-bold text-ink-2 hover:bg-surface-2 hover:text-ink">
      {busy ? <Loader2 className="size-[18px] animate-spin" /> : <ArrowLeftRight className="size-[18px]" aria-hidden="true" />}
      {to === "del" ? "Open DEL Studio" : "Back to admin console"}
    </button>
  );
}
