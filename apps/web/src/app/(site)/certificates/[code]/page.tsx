import Link from "next/link";
import type { Metadata } from "next";
import { BadgeCheck, Check, SearchX } from "lucide-react";
import { serverGet } from "@/lib/server-api";
import { toCertificate } from "@/lib/normalize";
import { date, hours } from "@/lib/format";
import { LoopMark, LOOP_FULL } from "@/components/Logo";
import { PrintButton } from "@/components/PrintButton";
import { CertificateShare } from "@/components/CertificateShare";

export const dynamic = "force-dynamic";

async function load(code: string) {
  const r = code ? await serverGet(`/certificates/${encodeURIComponent(code)}`) : null;
  return r?.ok ? toCertificate(r.data) : null;
}

/**
 * Public by link, never listed in search engines (a learner's name is personal data; docs/TRUST.md).
 * The Open Graph card makes a shared link (LinkedIn, WhatsApp) show the certificate; image: ./opengraph-image.tsx.
 */
export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params;
  const cert = code === "verify" ? null : await load(code);
  const robots = { index: false, follow: false };
  if (!cert) return { title: "Certificate verification", robots };
  const title = `${cert.user.name}: ${cert.course.title}`;
  const description = `Verified certificate of completion from DevOps Easy Learning, issued ${date(cert.issuedAt)}. Certificate ${cert.code}.`;
  return {
    title: `Certificate: ${title}`,
    description,
    robots,
    alternates: cert.url ? { canonical: cert.url } : undefined,
    openGraph: { type: "website", title, description, url: cert.url, siteName: "DevOps Easy Learning" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function CertificatePage({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<{ code?: string }> }) {
  const { code: raw } = await params;
  const sp = await searchParams;
  const code = raw === "verify" ? (sp.code ?? "").trim() : raw;
  const cert = await load(code);
  const quiz = cert?.quizzes && cert.quizzes.averageBest != null ? cert.quizzes : null;

  return (
    <div className="container-x max-w-5xl pt-12">
      <form action="/certificates/verify" className="mb-10 flex flex-wrap items-end gap-3 print:hidden">
        <div className="min-w-0 flex-1">
          <label className="label" htmlFor="code">Verify a certificate</label>
          <input id="code" name="code" defaultValue={code} className="field" placeholder="Certificate code, e.g. DEL-7K2Q-94MX" />
        </div>
        <button className="btn btn-primary">Verify</button>
      </form>

      {cert ? (
        <>
          <p className="mb-4 flex items-center gap-2 font-bold text-mint print:hidden" data-testid="cert-valid"><BadgeCheck className="size-5" />Verified: this certificate was issued by DevOps Easy Learning.</p>
          <article className="relative overflow-hidden rounded-panel border border-line bg-surface px-6 py-12 shadow-lift sm:px-14 sm:py-16" aria-label="Certificate of completion">
            <svg viewBox="0 0 120 60" className="pointer-events-none absolute -right-16 -top-6 w-[60%] opacity-[0.08]" fill="none" aria-hidden="true"><path d={LOOP_FULL} stroke="var(--violet)" strokeWidth="6" /></svg>
            <div className="flex items-center gap-3"><LoopMark className="h-8 w-16" /><span className="font-display font-extrabold">DevOps Easy Learning</span></div>
            <p className="mt-12 text-sm font-bold text-muted">Certificate of completion</p>
            <h1 className="mt-3 font-display text-[clamp(2rem,5vw,3.4rem)] font-extrabold leading-none tracking-[-0.03em]">{cert.user.name}</h1>
            <p className="mt-6 max-w-xl text-lg text-ink-2">has completed every lecture of</p>
            <p className="mt-2 max-w-2xl font-display text-2xl font-bold text-violet">{cert.course.title}</p>
            <dl className="mt-12 grid gap-6 border-t border-line pt-6 text-sm sm:grid-cols-3">
              <div><dt className="text-muted">Issued</dt><dd className="font-bold">{date(cert.issuedAt)}</dd></div>
              {cert.course.instructorName ? <div><dt className="text-muted">Instructor</dt><dd className="font-bold">{cert.course.instructorName}</dd></div> : null}
              <div><dt className="text-muted">Certificate code</dt><dd className="font-bold tracking-wide">{cert.code}</dd></div>
              {cert.course.totalDurationSec ? <div><dt className="text-muted">Course length</dt><dd className="font-bold">{hours(cert.course.totalDurationSec)}{cert.course.lessons ? `, ${cert.course.lessons} lessons` : ""}</dd></div> : null}
              {quiz ? <div><dt className="text-muted">Quizzes</dt><dd className="font-bold">{quiz.passed} of {quiz.total} passed, best scores average {quiz.averageBest} %</dd></div> : null}
            </dl>
            {cert.skills.length ? (
              <div className="mt-8 border-t border-line pt-6" data-testid="cert-skills">
                <h2 className="text-sm font-bold text-muted">What this course covered</h2>
                <ul className="mt-3 grid gap-x-8 gap-y-2 text-sm text-ink-2 sm:grid-cols-2">
                  {cert.skills.map((s) => <li key={s} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-mint" aria-hidden="true" /><span className="min-w-0">{s}</span></li>)}
                </ul>
              </div>
            ) : null}
          </article>
          <div className="mt-6 flex flex-wrap gap-3 print:hidden">
            {cert.url ? <CertificateShare url={cert.url} linkedInUrl={cert.linkedInUrl} /> : null}
            <PrintButton />
            {cert.course.slug && cert.course.published ? <Link href={`/courses/${cert.course.slug}`} className="btn btn-ghost">View the course</Link> : null}
          </div>
          <p className="mt-4 max-w-2xl text-sm text-muted print:hidden">Anyone with this link can check the certificate. It shows only the learner&apos;s name and the course, and it isn&apos;t listed in search engines.</p>
        </>
      ) : code ? (
        <div className="panel p-10 text-center">
          <SearchX className="mx-auto size-10 text-rose" />
          <h1 className="mt-4 font-display text-2xl font-bold">No certificate matches “{code}”</h1>
          <p className="mt-2 text-ink-2">Check the code for typos. Codes are printed at the bottom of every certificate.</p>
        </div>
      ) : (
        <div className="panel p-10 text-center">
          <h1 className="font-display text-2xl font-bold">Check a certificate</h1>
          <p className="mt-2 text-ink-2">Enter the code printed on a DevOps Easy Learning certificate to confirm it is genuine.</p>
        </div>
      )}
    </div>
  );
}
