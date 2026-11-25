"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { CircleAlert, Clock, Loader2, Search } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { obj, strs } from "@/lib/normalize";
import { useAuth } from "./AuthProvider";
import { useToast } from "./Toast";

interface Profile { status: string; reviewNote: string | null; headline: string; bio: string; website: string; expertise: string[]; experience: string; plannedCourses: string; extraInfo: string }

/**
 * Become an instructor (owner 2026-11-25): every instructor starts as a student account and applies; DEL reviews it
 * (approve, reject, or ask for more information). Approval adds the Instructor role; student access stays.
 */
export function ApplyToTeach({ next = "/teach" }: { next?: string }) {
  const { me, loading, refresh, has } = useAuth();
  const toast = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [f, setF] = useState({ headline: "", bio: "", website: "", expertise: "", experience: "", plannedCourses: "", extraInfo: "" });
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const status = profile?.status ?? me?.instructorStatus ?? null;

  useEffect(() => {
    if (!me?.instructorStatus) return;
    api("/instructor/profile").then((r) => {
      const o = obj(r);
      const p: Profile = { status: String(o.status ?? ""), reviewNote: (o.reviewNote as string) ?? null, headline: String(o.headline ?? ""), bio: String(o.bio ?? ""), website: String(o.website ?? ""), expertise: strs(o.expertise), experience: String(o.experience ?? ""), plannedCourses: String(o.plannedCourses ?? ""), extraInfo: String(o.extraInfo ?? "") };
      setProfile(p);
      setF({ headline: p.headline, bio: p.bio, website: p.website, expertise: p.expertise.join(", "), experience: p.experience, plannedCourses: p.plannedCourses, extraInfo: p.extraInfo });
    }).catch(() => {});
  }, [me?.instructorStatus]);

  if (loading) return <div className="panel h-72 animate-pulse" />;
  if (!me) {
    return (
      <div className="panel p-7">
        <h2 className="font-display text-xl font-bold">Start your application</h2>
        <p className="mt-2 text-ink-2">Create a free student account first, then apply from your Student Studio in a few minutes.</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href={`/register?next=${encodeURIComponent(next)}`} className="btn btn-primary">Create a free account</Link>
          <Link href={`/login?next=${encodeURIComponent(next)}`} className="btn btn-outline">I already have one</Link>
        </div>
      </div>
    );
  }
  if (has("instructor") && status === "approved") {
    return (
      <div className="panel p-7">
        <h2 className="font-display text-xl font-bold">You’re an approved instructor</h2>
        <p className="mt-2 text-ink-2">Build a course, upload lessons and submit it for review from the Instructor Studio. Your Student Studio stays as it is.</p>
        <Link href="/studio" className="btn btn-primary mt-5">Open Instructor Studio</Link>
      </div>
    );
  }
  if ((status === "pending" || status === "under_review") && !editing) {
    return (
      <div className="panel p-7" data-testid="apply-pending">
        <Clock className="size-8 text-amber" aria-hidden="true" />
        <h2 className="mt-3 font-display text-xl font-bold">{status === "under_review" ? "Your application is being reviewed" : "Application received"}</h2>
        <p className="mt-2 text-ink-2">DevOps Easy Learning reviews every application, usually within two working days. We email you the decision, and the Instructor Studio appears in your studio switcher once you’re approved.</p>
      </div>
    );
  }

  const ask = status === "needs_info" || status === "rejected";
  return (
    <form
      className="panel space-y-5 p-6 sm:p-7"
      data-testid="apply-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await api("/instructor/apply", {
            method: "POST",
            body: {
              headline: f.headline.trim(), bio: f.bio.trim(), website: f.website.trim() || undefined,
              expertise: f.expertise.split(",").map((x) => x.trim()).filter(Boolean),
              experience: f.experience.trim(), plannedCourses: f.plannedCourses.trim(), extraInfo: f.extraInfo.trim() || undefined,
            },
          });
          setEditing(false);
          setProfile((p) => (p ? { ...p, status: "pending" } : { status: "pending" } as Profile));
          await refresh();
          toast("ok", "Application sent. We’ll email you the decision.");
        } catch (err) {
          toast("error", errMsg(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      <div>
        <h2 className="font-display text-xl font-bold">{ask ? "Update your application" : "Apply to teach on DEL"}</h2>
        <p className="mt-1 text-sm text-ink-2">Signed in as <b className="text-ink">{me.name}</b> ({me.email}). Your student access stays exactly as it is.</p>
      </div>
      {ask && profile?.reviewNote ? (
        <p className="flex gap-2 rounded-tile border border-line bg-amber-soft px-4 py-3 text-sm text-ink" role="status">
          {status === "needs_info" ? <Search className="mt-0.5 size-4 shrink-0 text-amber" /> : <CircleAlert className="mt-0.5 size-4 shrink-0 text-amber" />}
          <span><b>{status === "needs_info" ? "DEL asked for more information:" : "Why it wasn’t approved:"}</b> {profile.reviewNote}</span>
        </p>
      ) : null}
      <div>
        <label className="label" htmlFor="headline">Professional headline</label>
        <input id="headline" className="field" required minLength={3} maxLength={120} value={f.headline} onChange={(e) => setF({ ...f, headline: e.target.value })} placeholder="Staff SRE, runs Kubernetes platforms for 40 teams" />
      </div>
      <div>
        <label className="label" htmlFor="expertise">Areas of expertise</label>
        <input id="expertise" className="field" required value={f.expertise} onChange={(e) => setF({ ...f, expertise: e.target.value })} placeholder="Kubernetes, Terraform, AWS, MLOps" />
        <p className="hint">Separate with commas.</p>
      </div>
      <div>
        <label className="label" htmlFor="bio">Professional background</label>
        <textarea id="bio" className="field" required minLength={20} maxLength={5000} rows={4} value={f.bio} onChange={(e) => setF({ ...f, bio: e.target.value })} placeholder="Where you work, the systems you build and run." />
        <p className="hint">This becomes your public bio once you’re approved. You can edit it later.</p>
      </div>
      <div>
        <label className="label" htmlFor="experience">Teaching experience</label>
        <textarea id="experience" className="field" required minLength={20} maxLength={3000} rows={3} value={f.experience} onChange={(e) => setF({ ...f, experience: e.target.value })} placeholder="Workshops, mentoring, talks, videos, internal training…" />
      </div>
      <div>
        <label className="label" htmlFor="planned">Courses you plan to offer</label>
        <textarea id="planned" className="field" required minLength={10} maxLength={3000} rows={3} value={f.plannedCourses} onChange={(e) => setF({ ...f, plannedCourses: e.target.value })} placeholder="Titles and who each course is for." />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="website">Portfolio or website (optional)</label>
          <input id="website" type="url" className="field" value={f.website} onChange={(e) => setF({ ...f, website: e.target.value })} placeholder="https://" />
        </div>
        <div>
          <label className="label" htmlFor="extra">Anything else for DEL (optional)</label>
          <input id="extra" className="field" maxLength={3000} value={f.extraInfo} onChange={(e) => setF({ ...f, extraInfo: e.target.value })} placeholder="Sample lesson link, certifications…" />
        </div>
      </div>
      <button className="btn btn-primary" disabled={busy} data-testid="apply-submit">{busy ? <Loader2 className="size-4 animate-spin" /> : null}{ask ? "Send updated application" : "Send application"}</button>
    </form>
  );
}
