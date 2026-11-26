"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Check, Loader2, Route } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/Toast";
import { HOURS_CHOICES } from "@/lib/paths";

/**
 * "Follow this path" on /paths/<slug>. Guests are sent to sign in (and back here), like the cart's checkout step;
 * a signed-in student picks the hours a week they can study and finds the plan in the Student Studio.
 */
export function FollowPath({ slug, title }: { slug: string; title: string }) {
  const { me, loading } = useAuth();
  const toast = useToast();
  const [state, setState] = useState<"unknown" | "no" | "yes">("unknown");
  const [hours, setHours] = useState(5);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loading || !me) return;
    let alive = true;
    api(`/me/paths/${encodeURIComponent(slug)}`)
      .then(() => alive && setState("yes"))
      .catch(() => alive && setState("no")); // 404: not following yet
    return () => { alive = false; };
  }, [me, loading, slug]);

  if (loading) return <div className="h-12 animate-pulse rounded-tile bg-surface-2" />;
  if (!me) {
    return (
      <div>
        <Link href={`/login?next=${encodeURIComponent(`/paths/${slug}`)}`} className="btn btn-primary w-full" data-testid="follow-path">
          <Route className="size-4" aria-hidden="true" />Follow this path
        </Link>
        <p className="mt-2 text-center text-sm text-ink-2">Sign in or create a free account to get a weekly plan and track your progress.</p>
      </div>
    );
  }
  if (state === "yes") {
    return (
      <div>
        <p className="flex items-center gap-2 font-bold text-mint"><Check className="size-5" aria-hidden="true" />You follow this path</p>
        <Link href="/student/paths" className="btn btn-outline mt-3 w-full" data-testid="open-path-plan">Open my plan<ArrowRight className="size-4" aria-hidden="true" /></Link>
      </div>
    );
  }
  async function follow() {
    setBusy(true);
    try {
      await api(`/me/paths/${encodeURIComponent(slug)}`, { method: "PUT", body: { hoursPerWeek: hours } });
      setState("yes");
      toast("ok", `You follow ${title}. Your weekly plan is in the Student Studio.`);
    } catch (e) { toast("error", errMsg(e)); } finally { setBusy(false); }
  }
  return (
    <div>
      <label htmlFor="path-hours" className="text-sm font-bold text-ink">Time you can study each week</label>
      <select id="path-hours" className="field mt-1.5" value={hours} onChange={(e) => setHours(Number(e.target.value))} disabled={state === "unknown"}>
        {HOURS_CHOICES.map((h) => <option key={h} value={h}>{h} hours a week</option>)}
      </select>
      <button type="button" className="btn btn-primary mt-3 w-full" onClick={() => void follow()} disabled={busy || state === "unknown"} data-testid="follow-path">
        {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Route className="size-4" aria-hidden="true" />}Follow this path
      </button>
      <p className="mt-2 text-sm text-ink-2">Free. You buy each course on its own when you reach it.</p>
    </div>
  );
}
