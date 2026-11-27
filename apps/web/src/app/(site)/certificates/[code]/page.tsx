import Link from "next/link";
import type { Metadata } from "next";
import { BadgeCheck, ShieldAlert, SearchX } from "lucide-react";
import { serverGet } from "@/lib/server-api";
import { toCertificate } from "@/lib/normalize";
import { API_URL } from "@/lib/config";
import { date } from "@/lib/format";
import { CertificateActions } from "@/components/CertificateActions";

export const dynamic = "force-dynamic";

async function load(code: string) {
  const r = code ? await serverGet(`/certificates/${encodeURIComponent(code)}`) : null;
  return r?.ok ? toCertificate(r.data) : null;
}

/**
 * Public verification by link or QR code, never listed in search engines (a learner's name is personal data; docs/TRUST.md,
 * docs/CERTIFICATES.md). Checked against the database record by code: valid, revoked, or invalid (no such code).
 */
export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params;
  const cert = code === "verify" ? null : await load(code);
  const robots = { index: false, follow: false };
  if (!cert) return { title: "Verify a certificate", robots };
  const title = `${cert.user.name}: ${cert.course.title}`;
  const description = cert.status === "revoked"
    ? `This DevOps Easy Learning certificate (${cert.code}) has been revoked.`
    : `Verified certificate of completion from DevOps Easy Learning, issued ${date(cert.issuedAt)}. Certificate ${cert.code}.`;
  return {
    title: `Certificate: ${title}`,
    description,
    robots,
    alternates: cert.url ? { canonical: cert.url } : undefined,
    openGraph: { type: "website", title, description, url: cert.url, siteName: "DevOps Easy Learning" },
    twitter: { card: "summary_large_image", title, description },
  };
}

function Fact({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return <div className="min-w-0"><dt className="text-sm text-muted">{k}</dt><dd className={`font-bold text-ink ${mono ? "tracking-wide" : ""}`}>{v}</dd></div>;
}

export default async function CertificatePage({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<{ code?: string }> }) {
  const { code: raw } = await params;
  const sp = await searchParams;
  const code = raw === "verify" ? (sp.code ?? "").trim() : raw;
  const cert = await load(code);
  const revoked = cert?.status === "revoked";

  return (
    <div className="container-x max-w-6xl pt-10 pb-16">
      <form action="/certificates/verify" className="mb-8 flex flex-wrap items-end gap-3 print:hidden">
        <div className="min-w-0 flex-1">
          <label className="label" htmlFor="code">Verify a certificate</label>
          <input id="code" name="code" defaultValue={code} className="field" placeholder="Certificate ID, e.g. DEL-7KQ2M9XP4T" autoComplete="off" />
        </div>
        <button className="btn btn-primary">Verify</button>
      </form>

      {cert ? (
        <>
          <section
            aria-labelledby="ver-h"
            data-testid={revoked ? "cert-revoked" : "cert-valid"}
            className={`rounded-panel border p-5 sm:p-6 ${revoked ? "border-rose/40 bg-rose/5" : "border-mint/40 bg-mint/5"}`}
          >
            <h1 id="ver-h" className={`flex items-center gap-2 font-display text-xl font-extrabold ${revoked ? "text-rose" : "text-mint"}`}>
              {revoked ? <ShieldAlert className="size-6 shrink-0" /> : <BadgeCheck className="size-6 shrink-0" />}
              {revoked ? "Revoked: this certificate is no longer valid" : "Valid: this certificate is authentic"}
            </h1>
            <p className="mt-1 text-sm text-ink-2">
              {revoked
                ? `DevOps Easy Learning revoked it${cert.revokedAt ? ` on ${date(cert.revokedAt)}` : ""}. It must not be presented as a completed course.`
                : "Checked just now against DevOps Easy Learning's records."}
            </p>
            <dl className="mt-5 grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.7fr)_minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,1fr)]">
              <Fact k="Awarded to" v={cert.user.name} />
              <Fact k="Course completed" v={cert.course.title} />
              <Fact k="Issued by" v={cert.issuer} />
              <Fact k="Completion date" v={date(cert.issuedAt)} />
              <Fact k="Certificate ID" v={cert.code} mono />
            </dl>
          </section>

          <figure className="mt-8">
            {/* eslint-disable-next-line @next/next/no-img-element -- the official certificate, drawn by the API (fixed colours in every theme) */}
            <img
              src={`${API_URL}/certificates/${encodeURIComponent(cert.code)}/certificate.svg`}
              alt={`Certificate of Completion awarded to ${cert.user.name} for ${cert.course.title}, ${date(cert.issuedAt)}, ID ${cert.code}`}
              width={1100}
              height={850}
              className="h-auto w-full rounded-md shadow-lift ring-1 ring-black/5"
              data-qa-on-media
              data-testid="cert-image"
            />
            <figcaption className="sr-only">The certificate as issued. Download it as a PDF or PNG below.</figcaption>
          </figure>

          <div className="mt-6 print:hidden">
            <CertificateActions code={cert.code} url={cert.url} linkedInUrl={cert.linkedInUrl} valid={!revoked} />
          </div>
          <p className="mt-4 max-w-3xl text-sm text-muted print:hidden">
            Anyone can check this certificate by scanning its QR code or entering its ID here; no account needed. The check shows only the learner&apos;s name,
            the course, the issuer, the date and the ID, and it isn&apos;t listed in search engines. This is a certificate of course completion, not an accredited qualification.
            {cert.course.slug && cert.course.published ? <> <Link href={`/courses/${cert.course.slug}`} className="link">View the course</Link>.</> : null}
          </p>
        </>
      ) : code ? (
        <div className="panel p-10 text-center" data-testid="cert-invalid">
          <SearchX className="mx-auto size-10 text-rose" />
          <h1 className="mt-4 font-display text-2xl font-bold">Invalid: no certificate matches “{code}”</h1>
          <p className="mt-2 text-ink-2">DevOps Easy Learning has not issued a certificate with this ID. Check it for typos; the ID is printed next to the QR code on every certificate.</p>
        </div>
      ) : (
        <div className="panel p-10 text-center">
          <h1 className="font-display text-2xl font-bold">Verify a certificate</h1>
          <p className="mt-2 text-ink-2">Enter the ID printed on a DevOps Easy Learning certificate, or scan its QR code, to confirm it is authentic. No account needed.</p>
        </div>
      )}
    </div>
  );
}
