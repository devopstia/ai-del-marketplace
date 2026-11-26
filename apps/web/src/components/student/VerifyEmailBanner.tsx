"use client";
import { useState } from "react";
import { Loader2, MailCheck } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { useAuth } from "../AuthProvider";
import { useToast } from "../Toast";

/** Asks email sign-ups to confirm their address (Google and the other providers already verified it). */
export function VerifyEmailBanner() {
  const { me } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  if (!me || me.emailVerified !== false || me.signupMethod === "seed") return null;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line bg-cyan-soft px-4 py-2.5 text-sm text-ink sm:px-6 lg:px-8" role="status" data-testid="verify-email">
      <MailCheck className="size-4 shrink-0 text-cyan-ink" aria-hidden="true" />
      <span className="min-w-[12rem] flex-1 [overflow-wrap:anywhere]">{sent ? <>We sent a confirmation link to <b>{me.email}</b>. Check your inbox and spam folder.</> : <>Please confirm your email address, <b>{me.email}</b>, so receipts and password resets reach you.</>}</span>
      {!sent ? (
        <button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={async () => {
          setBusy(true);
          try { await api("/auth/verify-email/send", { method: "POST" }); setSent(true); } catch (e) { toast("error", errMsg(e)); } finally { setBusy(false); }
        }}>{busy ? <Loader2 className="size-4 animate-spin" /> : null}Send the link</button>
      ) : null}
    </div>
  );
}
