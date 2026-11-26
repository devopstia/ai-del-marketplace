"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { BookOpen } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { list, toLearningItem } from "@/lib/normalize";
import { date, hours } from "@/lib/format";
import type { LearningItem } from "@/lib/types";
import { LoopMeter } from "@/components/LoopMeter";
import { Empty, Skeleton } from "@/components/Empty";
import { DataTable, Kpis, PageHead } from "@/components/shell/AppShell";
import { CertificateAction, resumeHref } from "@/components/student/MyCourses";

/** Lessons completed per course, completion and overall progress (from the API, never estimated). */
export default function LearningProgress() {
  const [items, setItems] = useState<LearningItem[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { api("/me/learning").then((r) => setItems(list(r, "courses", "enrollments").map(toLearningItem))).catch((e) => setErr(errMsg(e))); }, []);
  const lessons = (items ?? []).reduce((n, i) => n + (i.totalLectures ?? 0), 0);
  const doneLessons = (items ?? []).reduce((n, i) => n + (i.completedLectures ?? 0), 0);
  const issue = (slug: string) => (code: string) => setItems((xs) => xs?.map((x) => (x.course.slug === slug ? { ...x, certificateCode: code } : x)) ?? null);
  return (
    <div className="max-w-[1600px]">
      <PageHead title="Learning progress" sub="Completed lessons and completion for every course you are enrolled in." />
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
            <DataTable head={["Course", "Lessons", "Progress", "Last studied", "Certificate", ""]} min={760}>
              {items.map((i) => (
                <tr key={i.course.slug} data-testid="progress-row">
                  <td className="px-4 py-3.5"><Link href={`/courses/${i.course.slug}`} className="font-bold hover:text-violet">{i.course.title}</Link><p className="text-xs text-muted">{i.course.instructor.name}{i.course.totalDurationSec ? `, ${hours(i.course.totalDurationSec)}` : ""}</p></td>
                  <td className="px-4 py-3.5 tabular-nums">{i.completedLectures ?? 0} of {i.totalLectures ?? 0}</td>
                  <td className="px-4 py-3.5"><LoopMeter value={i.progressPct} size="sm" /></td>
                  <td className="px-4 py-3.5 text-ink-2">{i.lastActivityAt ? date(i.lastActivityAt) : "Not started"}</td>
                  <td className="px-4 py-3.5"><CertificateAction item={i} onIssued={issue(i.course.slug)} />{i.progressPct < 100 && !i.certificateCode ? <span className="text-xs text-muted">At 100%</span> : null}</td>
                  <td className="px-4 py-3.5 text-right"><Link href={resumeHref(i)} className="btn btn-ghost btn-sm">{i.progressPct >= 100 ? "Review" : "Continue"}</Link></td>
                </tr>
              ))}
            </DataTable>
          </div>
        </>
      ) : null}
    </div>
  );
}
