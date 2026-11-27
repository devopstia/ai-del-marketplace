"use client";
import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2, MailX } from "lucide-react";
import { api, errMsg } from "@/lib/api";

/**
 * One-click opt-out from learning tips and course suggestions (owner 2026-11-28). The link in those emails is signed;
 * this page asks for a click before changing anything, so a mail scanner that opens links never unsubscribes anyone.
 * Account, security, receipt and access emails are not affected.
 */
function LearningEmails() {
  const sp = useSearchParams();
  const u = sp.get("u") ?? "";
  const t = sp.get("t") ?? "";
  const [state, setState] = useState<"ask" | "busy" | "off" | "on" | "error">("ask");
  const [msg, setMsg] = useState("");
  const set = async (on: boolean) => {
    setState("busy");
    try {
      await api("/email/learning-emails/link", { method: "POST", body: { u, t, on } });
      setState(on ? "on" : "off");
    } catch (e) {
      setMsg(errMsg(e));
      setState("error");
    }
  };
  const valid = u && t;
  return (
    <div className="container-x max-w-xl py-16" data-testid="learning-emails">
      <MailX className="size-10 text-violet" aria-hidden="true" />
      <h1 className="mt-4 font-display text-[2rem] font-extrabold leading-tight">Learning tips and course suggestions</h1>
      {!valid ? (
        <p className="mt-3 text-ink-2">This link is incomplete. Sign in and change your email choices in <Link href="/student/account" className="link">Account</Link>.</p>
      ) : state === "off" ? (
        <>
          <p className="mt-3 flex items-center gap-2 text-ink-2" role="status"><CheckCircle2 className="size-5 text-mint" aria-hidden="true" />Done. You won’t receive learning tips or course suggestions any more.</p>
          <p className="mt-2 text-sm text-muted">Receipts, access and security emails still reach you. Changed your mind? <button type="button" className="link" onClick={() => void set(true)}>Turn them back on</button>.</p>
        </>
      ) : state === "on" ? (
        <p className="mt-3 flex items-center gap-2 text-ink-2" role="status"><CheckCircle2 className="size-5 text-mint" aria-hidden="true" />They’re back on. Thanks for learning with us.</p>
      ) : (
        <>
          <p className="mt-3 text-ink-2">After you join a free course we send a few short emails: a welcome, a reminder if you haven’t started, and courses that build on it. Do you want to stop them?</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button type="button" className="btn btn-primary" disabled={state === "busy"} onClick={() => void set(false)} data-testid="learning-emails-off">
              {state === "busy" ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}Stop these emails
            </button>
            <Link href="/student" className="btn btn-outline">Keep them</Link>
          </div>
          {state === "error" ? <p className="mt-3 text-sm text-rose" role="alert">{msg}</p> : null}
          <p className="mt-6 text-sm text-muted">Receipts, access reminders and security emails are not affected.</p>
        </>
      )}
    </div>
  );
}

export default function LearningEmailsPage() {
  return <Suspense><LearningEmails /></Suspense>;
}
