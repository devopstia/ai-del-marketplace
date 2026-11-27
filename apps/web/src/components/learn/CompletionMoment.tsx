"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Award, Loader2, Star } from "lucide-react";
import { api } from "@/lib/api";
import { obj, toCertificate } from "@/lib/normalize";
import type { Certificate } from "@/lib/types";
import { CertificateActions } from "../CertificateActions";

/**
 * The completion moment (owner 2026-11-28): once every lesson is done, the certificate is the hero of the lesson
 * page: "You earned your certificate" with Add to LinkedIn, PDF and copy link, and a rating prompt if the learner
 * hasn't rated the course yet. The certificate is issued automatically; this only fetches it.
 */
export function CompletionMoment({ slug, courseTitle, reviewed, canReview, onRate }: { slug: string; courseTitle: string; reviewed: boolean; canReview: boolean; onRate: () => void }) {
  const [cert, setCert] = useState<Certificate | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const issued = obj(await api(`/courses/${encodeURIComponent(slug)}/certificate`, { method: "POST" }));
        const code = String(issued.code ?? "");
        if (!code) throw new Error("no code");
        const full = toCertificate(await api(`/certificates/${encodeURIComponent(code)}`));
        if (live) setCert(full);
      } catch {
        if (live) setFailed(true);
      }
    })();
    return () => { live = false; };
  }, [slug]);

  return (
    <section className="mt-8 rounded-panel border border-line bg-surface p-5 sm:p-6" aria-labelledby="done-h" data-testid="completion-moment">
      <div className="flex items-start gap-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-full bg-[color-mix(in_srgb,var(--violet)_14%,transparent)] text-violet"><Award className="size-6" aria-hidden="true" /></span>
        <div className="min-w-0">
          <h2 id="done-h" className="font-display text-xl font-extrabold">You earned your certificate</h2>
          <p className="mt-1 text-ink-2">You completed every lesson of <b className="text-ink">{courseTitle}</b>. Share it with your network or keep a copy for your records.</p>
        </div>
      </div>
      <div className="mt-5">
        {cert?.code ? (
          <>
            <CertificateActions code={cert.code} url={cert.url} linkedInUrl={cert.linkedInUrl} valid={cert.status !== "revoked"} />
            <p className="mt-3 text-sm text-muted">Certificate {cert.code} · <Link href={`/certificates/${encodeURIComponent(cert.code)}`} className="link">open the certificate page</Link></p>
          </>
        ) : failed ? (
          <Link href="/student/progress" className="btn btn-primary">See your certificates</Link>
        ) : (
          <p className="flex items-center gap-2 text-sm text-muted"><Loader2 className="size-4 animate-spin" aria-hidden="true" />Preparing your certificate…</p>
        )}
      </div>
      {canReview && !reviewed ? (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4" data-testid="completion-rate">
          <p className="min-w-0 text-sm text-ink-2">How was the course? A short rating helps other learners choose.</p>
          <button type="button" className="btn btn-outline btn-sm" onClick={onRate}><Star className="size-4" aria-hidden="true" />Rate this course</button>
        </div>
      ) : null}
    </section>
  );
}
