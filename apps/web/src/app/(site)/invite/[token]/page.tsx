"use client";
import Link from "next/link";
import { use, useEffect, useState } from "react";
import { BookOpen, CheckCircle2, CircleAlert, Loader2, MailCheck } from "lucide-react";
import { api, errMsg, setCsrf } from "@/lib/api";
import { obj } from "@/lib/normalize";
import { date } from "@/lib/format";
import { useAuth } from "@/components/AuthProvider";

interface Info { email: string; name: string; expiresAt: string; accountExists: boolean; courses: { title: string; expiresAt: string }[] }

/**
 * Invitation from DevOps Easy Learning (manual enrollment). Opening the link only shows the invitation: the student
 * proves the email with a code, chooses their own password, then sets up Google Authenticator like every new account.
 */
export default function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const { me, loading } = useAuth();
  const [info, setInfo] = useState<Info | null>(null);
  const [err, setErr] = useState<{ code: string; message: string } | null>(null);
  const [step, setStep] = useState<"start" | "code">("start");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    api(`/invitations/${encodeURIComponent(token)}`).then((r) => { const o = obj(r) as unknown as Info; setInfo(o); setName(o.name); })
      .catch((e) => setErr({ code: String((e as { code?: string }).code ?? ""), message: errMsg(e) }));
  }, [token]);

  async function sendCode() {
    setBusy(true); setFormErr(null);
    try { await api(`/invitations/${encodeURIComponent(token)}/code`, { method: "POST" }); setStep("code"); } catch (e) { setFormErr(errMsg(e)); } finally { setBusy(false); }
  }
  async function accept(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setFormErr(null);
    try {
      const r = obj(await api(`/invitations/${encodeURIComponent(token)}/accept`, { method: "POST", body: { code: code.trim(), name: name.trim(), password: pw } }));
      if (r.mfa) { window.location.assign("/login/verify?next=%2Fstudent%2Fcourses"); return; }
      setCsrf(r.csrf as string);
      window.location.assign("/student/courses");
    } catch (x) { setFormErr(errMsg(x)); setBusy(false); }
  }
  async function claim() {
    setBusy(true); setFormErr(null);
    try { await api(`/invitations/${encodeURIComponent(token)}/claim`, { method: "POST" }); setDone(true); } catch (x) { setFormErr(errMsg(x)); } finally { setBusy(false); }
  }

  return (
    <div className="container-x grid max-w-5xl gap-10 py-10 md:grid-cols-[1fr_1.1fr] md:py-16">
      <div>
        <p className="text-sm font-bold text-violet">Invitation from DevOps Easy Learning</p>
        <h1 className="mt-2 font-display text-[clamp(1.9rem,4vw,2.6rem)] font-extrabold leading-tight">{info ? `Welcome, ${info.name.split(" ")[0]}` : "Your courses are waiting"}</h1>
        <p className="mt-3 text-ink-2">DevOps Easy Learning has enrolled you in these courses. Create your account to start learning.</p>
        {info ? (
          <ul className="mt-6 divide-y divide-line rounded-tile border border-line bg-surface" data-testid="invite-courses">
            {info.courses.map((c) => <li key={c.title} className="flex items-start gap-3 px-4 py-3"><BookOpen className="mt-0.5 size-5 shrink-0 text-violet" /><span><b className="block text-ink">{c.title}</b><span className="text-sm text-muted">Access until {date(c.expiresAt)}</span></span></li>)}
          </ul>
        ) : null}
      </div>

      <div className="panel p-6 sm:p-8">
        {err ? (
          <div role="alert"><CircleAlert className="size-8 text-amber" /><h2 className="mt-3 font-display text-xl font-bold">This invitation can’t be used</h2><p className="mt-2 text-ink-2">{err.message}</p>
            <div className="mt-5 flex flex-wrap gap-2"><Link href="/login" className="btn btn-outline">Sign in</Link><Link href="/contact" className="btn btn-ghost">Contact DEL</Link></div></div>
        ) : !info || loading ? <Loader2 className="size-6 animate-spin text-violet" /> : done ? (
          <div role="status"><CheckCircle2 className="size-8 text-mint" /><h2 className="mt-3 font-display text-xl font-bold">The courses are in your account</h2><Link href="/student/courses" className="btn btn-primary mt-5">Go to My courses</Link></div>
        ) : me ? (
          <div>
            <h2 className="font-display text-xl font-bold">Add the courses to your account</h2>
            <p className="mt-2 text-ink-2">You’re signed in as <b className="text-ink">{me.email}</b>. The invitation is for <b className="text-ink">{info.email}</b>; it works only for that account.</p>
            {formErr ? <p className="mt-3 text-sm font-bold text-rose" role="alert">{formErr}</p> : null}
            <button type="button" className="btn btn-primary mt-5" disabled={busy} onClick={claim} data-testid="invite-claim">{busy ? <Loader2 className="size-4 animate-spin" /> : null}Add to my account</button>
          </div>
        ) : info.accountExists ? (
          <div>
            <h2 className="font-display text-xl font-bold">You already have an account</h2>
            <p className="mt-2 text-ink-2">Sign in as <b className="text-ink">{info.email}</b> with your usual method (password, Google, GitHub…), then come back to this link.</p>
            <Link href={`/login?next=${encodeURIComponent(`/invite/${token}`)}`} className="btn btn-primary mt-5">Sign in</Link>
          </div>
        ) : step === "start" ? (
          <div>
            <h2 className="font-display text-xl font-bold">Create your account</h2>
            <p className="mt-2 text-ink-2">First we confirm the invitation is yours: we email a six-digit code to <b className="text-ink">{info.email}</b>.</p>
            {formErr ? <p className="mt-3 text-sm font-bold text-rose" role="alert">{formErr}</p> : null}
            <button type="button" className="btn btn-primary mt-5" disabled={busy} onClick={sendCode} data-testid="invite-send-code">{busy ? <Loader2 className="size-4 animate-spin" /> : <MailCheck className="size-4" />}Email me the code</button>
            <p className="mt-3 text-xs text-muted">Invitation valid until {date(info.expiresAt)}. Then you set up Google Authenticator, like every DEL account.</p>
          </div>
        ) : (
          <form onSubmit={accept} className="space-y-4" data-testid="invite-form">
            <h2 className="font-display text-xl font-bold">Create your account</h2>
            <div><label className="label" htmlFor="inv-code">Code from the email</label><input id="inv-code" className="field tabular-nums tracking-[0.3em]" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} required />
              <button type="button" className="hint link" onClick={sendCode} disabled={busy}>Send a new code</button></div>
            <div><label className="label" htmlFor="inv-name">Your name</label><input id="inv-name" className="field" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} /></div>
            <div><label className="label" htmlFor="inv-pw">Choose a password</label><input id="inv-pw" type="password" className="field" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} required minLength={12} /><p className="hint">At least 12 characters with letters and numbers. Only you know it.</p></div>
            {formErr ? <p className="text-sm font-bold text-rose" role="alert">{formErr}</p> : null}
            <button className="btn btn-primary w-full" disabled={busy || code.length !== 6} data-testid="invite-accept">{busy ? <Loader2 className="size-4 animate-spin" /> : null}Create account and continue</button>
          </form>
        )}
      </div>
    </div>
  );
}
