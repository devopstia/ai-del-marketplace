"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { api, errMsg, setCsrf } from "@/lib/api";
import { obj } from "@/lib/normalize";
import { useAuth } from "./AuthProvider";

function safeNext(n: string | null): string {
  return n && n.startsWith("/") && !n.startsWith("//") ? n : "/my-learning";
}

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const sp = useSearchParams();
  const next = safeNext(sp.get("next"));
  const { refresh } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const r = await api(`/auth/${mode}`, { method: "POST", body: mode === "login" ? { email, password } : { name, email, password } });
      setCsrf((obj(r).csrf ?? obj(r).csrfToken) as string | undefined);
      await refresh();
      // Full navigation, not router.push: in production Next.js may hold a prefetched copy of the target page made while the
      // visitor was signed out (a cached redirect to /login). Loading it fresh sends the new session cookie.
      window.location.assign(next);
    } catch (e2) {
      setErr(errMsg(e2));
      setBusy(false);
    }
  }

  const other = mode === "login" ? "/register" : "/login";
  return (
    <form onSubmit={submit} className="space-y-5" noValidate={false}>
      {err ? <p role="alert" className="rounded-tile border border-rose/40 bg-rose-soft px-4 py-3 text-sm font-bold text-rose">{err}</p> : null}
      {mode === "register" ? (
        <div>
          <label className="label" htmlFor="name">Full name</label>
          <input id="name" className="field" autoComplete="name" required minLength={2} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
      ) : null}
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input id="email" type="email" className="field" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div>
        <label className="label" htmlFor="password">Password</label>
        <div className="relative">
          <input id="password" type={show ? "text" : "password"} className="field pr-12" autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={mode === "register" ? 10 : 1} value={password} onChange={(e) => setPassword(e.target.value)} />
          <button type="button" className="absolute right-1.5 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-lg text-muted hover:text-ink" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"}>
            {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
        {mode === "register" ? <p className="hint">At least 10 characters. A short sentence works well.</p> : null}
      </div>
      <button className="btn btn-primary w-full" disabled={busy} data-testid="auth-submit">
        {busy ? <Loader2 className="size-4 animate-spin" /> : null}{mode === "login" ? "Log in" : "Create account"}
      </button>
      <p className="text-center text-sm text-ink-2">
        {mode === "login" ? "New to DevOps Easy Learning? " : "Already have an account? "}
        <Link href={`${other}${sp.get("next") ? `?next=${encodeURIComponent(next)}` : ""}`} className="link">{mode === "login" ? "Create an account" : "Log in"}</Link>
      </p>
    </form>
  );
}
