"use client";
import Link from "next/link";
import { useState } from "react";
import { Clock, Loader2 } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { useAuth } from "./AuthProvider";
import { useToast } from "./Toast";

export function ApplyToTeach() {
  const { me, loading, refresh, has } = useAuth();
  const toast = useToast();
  const [headline, setHeadline] = useState("");
  const [bio, setBio] = useState("");
  const [website, setWebsite] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  if (loading) return <div className="panel h-72 animate-pulse" />;
  if (!me) {
    return (
      <div className="panel p-7">
        <h2 className="font-display text-xl font-bold">Start your application</h2>
        <p className="mt-2 text-ink-2">Create a free account first. You’ll apply from here in about two minutes.</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/register?next=/teach" className="btn btn-primary">Create an account</Link>
          <Link href="/login?next=/teach" className="btn btn-outline">I already have one</Link>
        </div>
      </div>
    );
  }
  if (has("instructor") && me.instructorStatus !== "pending") {
    return (
      <div className="panel p-7">
        <h2 className="font-display text-xl font-bold">You’re an approved instructor</h2>
        <p className="mt-2 text-ink-2">Create a course, upload lectures and submit it for review from your studio.</p>
        <Link href="/studio" className="btn btn-primary mt-5">Open instructor studio</Link>
      </div>
    );
  }
  if (sent || me.instructorStatus === "pending") {
    return (
      <div className="panel p-7" data-testid="apply-pending">
        <Clock className="size-8 text-amber" />
        <h2 className="mt-3 font-display text-xl font-bold">Application received</h2>
        <p className="mt-2 text-ink-2">An admin reviews every application, usually within two working days. Your studio unlocks as soon as you’re approved.</p>
      </div>
    );
  }
  if (me.instructorStatus === "rejected") {
    return (
      <div className="panel p-7">
        <h2 className="font-display text-xl font-bold">Your application wasn’t approved</h2>
        <p className="mt-2 text-ink-2">Contact support if you’d like the decision reviewed or want to reapply with more detail.</p>
      </div>
    );
  }
  return (
    <form
      className="panel space-y-5 p-6 sm:p-7"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await api("/instructor/apply", { method: "POST", body: { headline, bio, website: website || undefined } });
          setSent(true);
          await refresh();
          toast("ok", "Application sent.");
        } catch (err) {
          toast("error", errMsg(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2 className="font-display text-xl font-bold">Apply to teach</h2>
      <div>
        <label className="label" htmlFor="headline">Professional headline</label>
        <input id="headline" className="field" required maxLength={120} value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="Staff SRE, runs Kubernetes platforms for 40 teams" />
      </div>
      <div>
        <label className="label" htmlFor="bio">What would you teach, and why you?</label>
        <textarea id="bio" className="field" required minLength={40} maxLength={4000} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Your experience, the systems you run, and the course you have in mind." />
        <p className="hint">This becomes your public bio once you’re approved. You can edit it later.</p>
      </div>
      <div>
        <label className="label" htmlFor="website">Website or GitHub (optional)</label>
        <input id="website" type="url" className="field" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://" />
      </div>
      <button className="btn btn-primary" disabled={busy} data-testid="apply-submit">{busy ? <Loader2 className="size-4 animate-spin" /> : null}Send application</button>
    </form>
  );
}
