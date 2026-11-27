"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Award, BookOpen, Download, FileImage } from "lucide-react";
import { API_URL } from "@/lib/config";
import { obj } from "@/lib/normalize";

const str = (v: unknown, d = "") => (typeof v === "string" ? v : v == null ? d : String(v));
import { api, errMsg } from "@/lib/api";
import { list, toLearningItem } from "@/lib/normalize";

type MyCert = { code: string; issuedAt: string; status: string; title: string; slug: string };
import { date, hours } from "@/lib/format";
import type { LearningItem } from "@/lib/types";
import { LoopMeter } from "@/components/LoopMeter";
import { Empty, Skeleton } from "@/components/Empty";
import { DataTable, Kpis, PageHead } from "@/components/shell/AppShell";
import { CertificateAction, resumeHref } from "@/components/student/MyCourses";
import { RefundLine } from "@/components/student/RefundLine";

/** Lessons completed per course, completion and overall progress (from the API, never estimated). */
export default function LearningProgress() {
  const [items, setItems] = useState<LearningItem[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [certs, setCerts] = useState<MyCert[]>([]);
  useEffect(() => { api("/me/learning").then((r) => setItems(list(r, "courses", "enrollments").map(toLearningItem))).catch((e) => setErr(errMsg(e))); }, []);
  // Every certificate earned, also for courses whose access has ended (certificates are kept for good).
  useEffect(() => { api("/me/certificates").then((r) => setCerts(list(r, "items").map((x) => { const o = obj(x); const c = obj(o.course); return { code: str(o.code), issuedAt: str(o.issuedAt), status: str(o.status, "valid"), title: str(c.title), slug: str(c.slug) }; }))).catch(() => setCerts([])); }, []);
  const lessons = (items ?? []).reduce((n, i) => n + (i.totalLectures ?? 0), 0);
  const doneLessons = (items ?? []).reduce((n, i) => n + (i.completedLectures ?? 0), 0);
  const issue = (slug: string) => (code: string) => setItems((xs) => xs?.map((x) => (x.course.slug === slug ? { ...x, certificateCode: code } : x)) ?? null);
  return (
    <div className="max-w-[1600px]">
      <PageHead title="Learning progress" sub="Completed lessons, video watched and your refund position for every course you are enrolled in. Open a course for the full report." />
      {err ? <p className="text-rose">{err}</p> : null}
      {!items && !err ? <Skeleton className="h-64" /> : null}
      {items && !items.length ? <Empty icon={BookOpen} title="No courses yet" body="Your progress appears here once you enrol in a course." href="/courses" cta="Browse courses" /> : null}
      {items && items.length ? (
        <>
          <Kpis items={[
            { label: "Lessons completed", value: `${doneLessons} / ${lessons}` },
            { label: "Courses completed", value: String(items.filter((i) => i.progressPct >= 100).length) },
            { label: "Certificates", value: String(items.filter((i) => i.certificateCode).length) },
            { label: "Overall progress", value: `${lessons ? Math.round((doneLessons / lessons) * 100) : 0}%`, note: "Lessons completed across all courses" },
          ]} />
          <div className="mt-8">
            <DataTable head={["Course", "Lessons", "Progress", "Last studied", "Refund", "Certificate", ""]} min={900}>
              {items.map((i) => (
                <tr key={i.course.slug} data-testid="progress-row">
                  <td className="px-4 py-3.5"><Link href={`/student/progress/${i.course.slug}`} className="font-bold hover:text-violet" data-testid="progress-details">{i.course.title}</Link><p className="text-xs text-muted">{i.course.instructor.name}{i.course.totalDurationSec ? `, ${hours(i.course.totalDurationSec)}` : ""}</p></td>
                  <td className="px-4 py-3.5 tabular-nums">{i.completedLectures ?? 0} of {i.totalLectures ?? 0}</td>
                  <td className="px-4 py-3.5"><LoopMeter value={i.progressPct} size="sm" /></td>
                  <td className="px-4 py-3.5 text-ink-2">{i.lastActivityAt ? date(i.lastActivityAt) : "Not started"}</td>
                  <td className="max-w-[16rem] px-4 py-3.5">{i.refund ? <RefundLine r={i.refund} compact /> : <span className="text-xs text-muted">Not a purchase</span>}</td>
                  <td className="px-4 py-3.5"><CertificateAction item={i} onIssued={issue(i.course.slug)} />{i.progressPct < 100 && !i.certificateCode ? <span className="text-xs text-muted">At 100%</span> : null}</td>
                  <td className="px-4 py-3.5 text-right"><span className="inline-flex gap-1"><Link href={`/student/progress/${i.course.slug}`} className="btn btn-ghost btn-sm">Report</Link><Link href={resumeHref(i)} className="btn btn-ghost btn-sm">{i.progressPct >= 100 ? "Review" : "Continue"}</Link></span></td>
                </tr>
              ))}
            </DataTable>
          </div>
        </>
      ) : null}
      {certs.length ? (
        <section className="mt-10" aria-labelledby="certs-h" data-testid="my-certificates">
          <h2 id="certs-h" className="font-display text-xl font-bold">Your certificates</h2>
          <ul className="mt-4 grid gap-3 md:grid-cols-2">
            {certs.map((c) => (
              <li key={c.code} className="panel flex flex-col gap-3 p-4">
                <div className="flex min-w-0 items-start gap-3">
                  <Award className="mt-0.5 size-5 shrink-0 text-violet" aria-hidden="true" />
                  <div className="min-w-0"><p className="font-bold">{c.title}</p><p className="text-sm text-muted">Issued {date(c.issuedAt)} · {c.code}{c.status === "revoked" ? " · revoked" : ""}</p></div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link href={`/certificates/${c.code}`} className="btn btn-outline btn-sm">View</Link>
                  <a href={`${API_URL}/certificates/${encodeURIComponent(c.code)}/certificate.pdf`} className="btn btn-ghost btn-sm"><Download className="size-4" />PDF</a>
                  <a href={`${API_URL}/certificates/${encodeURIComponent(c.code)}/certificate.png`} className="btn btn-ghost btn-sm"><FileImage className="size-4" />PNG</a>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
