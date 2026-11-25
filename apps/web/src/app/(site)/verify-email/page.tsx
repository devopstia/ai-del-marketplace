"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, CircleAlert, Loader2 } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";

/** Opening the link from the confirmation email (single use, 3 days). */
export default function VerifyEmail() {
  const { refresh } = useAuth();
  const [state, setState] = useState<"busy" | "ok" | "error">("busy");
  const [msg, setMsg] = useState("");
  const once = useRef(false);
  useEffect(() => {
    if (once.current) return;
    once.current = true;
    const token = new URLSearchParams(window.location.search).get("token") ?? "";
    api("/auth/verify-email", { method: "POST", body: { token } })
      .then(() => { setState("ok"); void refresh(); })
      .catch((e) => { setState("error"); setMsg(errMsg(e)); });
  }, [refresh]);
  return (
    <div className="container-x grid min-h-[50vh] max-w-lg place-items-center py-16 text-center">
      <div className="panel w-full p-8" role="status">
        {state === "busy" ? <><Loader2 className="mx-auto size-8 animate-spin text-violet" /><p className="mt-4 text-ink-2">Confirming your email…</p></> : null}
        {state === "ok" ? <><CheckCircle2 className="mx-auto size-10 text-mint" /><h1 className="mt-4 font-display text-2xl font-extrabold">Email confirmed</h1><p className="mt-2 text-ink-2">Thanks. Receipts and security messages will reach you.</p><Link href="/student" className="btn btn-primary mt-6">Go to your Student Studio</Link></> : null}
        {state === "error" ? <><CircleAlert className="mx-auto size-10 text-amber" /><h1 className="mt-4 font-display text-2xl font-extrabold">This link doesn’t work any more</h1><p className="mt-2 text-ink-2">{msg}</p><Link href="/student" className="btn btn-outline mt-6">Send a new link from your Student Studio</Link></> : null}
      </div>
    </div>
  );
}
