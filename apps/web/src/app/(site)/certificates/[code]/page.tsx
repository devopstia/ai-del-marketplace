import Link from "next/link";
import type { Metadata } from "next";
import { BadgeCheck, SearchX } from "lucide-react";
import { serverGet } from "@/lib/server-api";
import { toCertificate } from "@/lib/normalize";
import { date, hours } from "@/lib/format";
import { LoopMark, LOOP_FULL } from "@/components/Logo";
import { PrintButton } from "@/components/PrintButton";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Certificate verification" };

export default async function CertificatePage({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<{ code?: string }> }) {
  const { code: raw } = await params;
  const sp = await searchParams;
  const code = raw === "verify" ? (sp.code ?? "").trim() : raw;
  const r = code ? await serverGet(`/certificates/${encodeURIComponent(code)}`) : null;
  const cert = r?.ok ? toCertificate(r.data) : null;

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
          <p className="mb-4 flex items-center gap-2 font-bold text-mint print:hidden"><BadgeCheck className="size-5" />Verified: this certificate was issued by DevOps Easy Learning.</p>
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
              {cert.course.totalDurationSec ? <div><dt className="text-muted">Course length</dt><dd className="font-bold">{hours(cert.course.totalDurationSec)}</dd></div> : null}
            </dl>
          </article>
          <div className="mt-6 flex flex-wrap gap-3 print:hidden">
            <PrintButton />
            {cert.course.slug ? <Link href={`/courses/${cert.course.slug}`} className="btn btn-ghost">View the course</Link> : null}
          </div>
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
