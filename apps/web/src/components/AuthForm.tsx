"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Check, Circle, Eye, EyeOff, Loader2 } from "lucide-react";
import { api, errMsg, setCsrf } from "@/lib/api";
import { obj } from "@/lib/normalize";
import { useAuth } from "./AuthProvider";
import { Divider, OAUTH_ERRORS, safeNext, SocialButtons, useProviders } from "./auth/shared";

/** Live checks for the rules the API enforces (the breach check runs on the server). */
function rulesMet(pw: string, email: string, name: string) {
  const local = email.split("@")[0]?.toLowerCase() ?? "";
  const parts = name.toLowerCase().split(/\s+/).filter((x) => x.length >= 4);
  const lower = pw.toLowerCase();
  return [
    { label: "At least 12 characters", ok: pw.length >= 12 },
    { label: "A mix of letters and numbers", ok: /[A-Za-z]/.test(pw) && /\d/.test(pw) },
    { label: "Not your email address or name", ok: pw.length > 0 && !(local.length >= 4 && lower.includes(local)) && !parts.some((p) => lower.includes(p)) },
  ];
}

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const sp = useSearchParams();
  const next = safeNext(sp.get("next"));
  const { refresh } = useAuth();
  const providers = useProviders();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [err, setErr] = useState<string | null>(() => OAUTH_ERRORS[sp.get("error") ?? ""] ?? null);
  const [busy, setBusy] = useState(false);
  const rules = rulesMet(password, email, name);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const r = obj(await api(`/auth/${mode}`, { method: "POST", body: mode === "login" ? { email, password, next } : { name, email, password, next } }));
      if (r.mfa) {
        // A Google Authenticator code (or setting one up) comes next. Full navigation on purpose (AGENTS.md pitfall).
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.assign(`/login/verify?next=${encodeURIComponent(next)}`);
        return;
      }
      setCsrf((r.csrf ?? r.csrfToken) as string | undefined);
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
    <div>
      {err ? <p role="alert" className="mb-5 rounded-tile border border-rose/40 bg-rose-soft px-4 py-3 text-sm font-bold text-rose">{err}</p> : null}
      {providers?.items.length ? (
        <>
          <SocialButtons items={providers.items} next={next} verb={mode === "login" ? "Continue" : "Sign up"} />
          <Divider label={mode === "login" ? "or log in with email" : "or sign up with email"} />
        </>
      ) : null}
      <form onSubmit={submit} className="space-y-5">
        {mode === "register" ? (
          <div>
            <label className="label" htmlFor="name">Full name</label>
            <input id="name" className="field" autoComplete="name" required minLength={2} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
        ) : null}
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" type="email" className="field" autoComplete={mode === "login" ? "username" : "email"} required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <div className="flex items-baseline justify-between gap-3">
            <label className="label" htmlFor="password">Password</label>
            {mode === "login" ? <Link href="/forgot-password" className="link text-sm">Forgot password?</Link> : null}
          </div>
          <div className="relative">
            <input id="password" type={show ? "text" : "password"} className="field pr-12" autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={mode === "register" ? 12 : 1} maxLength={128} value={password} onChange={(e) => setPassword(e.target.value)} aria-describedby={mode === "register" ? "pw-rules" : undefined} />
            <button type="button" className="absolute right-1.5 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-lg text-muted hover:text-ink" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"}>
              {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          {mode === "register" ? (
            <ul id="pw-rules" className="mt-2.5 grid gap-1 text-sm" data-testid="password-rules">
              {rules.map((r) => (
                <li key={r.label} className={`flex items-center gap-2 ${r.ok ? "text-mint" : "text-muted"}`}>
                  {r.ok ? <Check className="size-4" aria-hidden /> : <Circle className="size-3.5" aria-hidden />}{r.label}<span className="sr-only">{r.ok ? " (done)" : " (not yet)"}</span>
                </li>
              ))}
              <li className="flex items-center gap-2 text-muted"><Circle className="size-3.5" aria-hidden />Not a password that has appeared in a data breach (we check when you continue)</li>
            </ul>
          ) : null}
        </div>
        <button className="btn btn-primary w-full" disabled={busy} data-testid="auth-submit">
          {busy ? <Loader2 className="size-4 animate-spin" /> : null}{mode === "login" ? "Log in" : "Create account"}
        </button>
        <p className="text-center text-sm text-ink-2">
          {mode === "login" ? "New to DevOps Easy Learning? " : "Already have an account? "}
          <Link href={`${other}${sp.get("next") ? `?next=${encodeURIComponent(next)}` : ""}`} className="link">{mode === "login" ? "Create an account" : "Log in"}</Link>
        </p>
        {mode === "register" ? <p className="text-center text-xs text-muted">Every account is protected with Google Authenticator: you’ll set it up in the next step. By creating an account you agree to the <Link href="/policies/terms" className="link">Terms of use</Link> and <Link href="/policies/privacy" className="link">Privacy policy</Link>.</p> : null}
      </form>
    </div>
  );
}
