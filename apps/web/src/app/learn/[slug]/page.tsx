"use client";
import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { obj, toCourseDetail } from "@/lib/normalize";

/** Resolves /learn/:slug to the lecture to resume: the last one touched, else the first unfinished one. */
export default function LearnIndex({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    api(`/me/courses/${slug}`).then((r) => {
      const c = toCourseDetail(r);
      const all = c.sections.flatMap((s) => s.lectures);
      const last = String(obj(r).lastLectureId ?? obj(obj(r).course).lastLectureId ?? "");
      const target = all.find((l) => l.id === last) ?? all.find((l) => !l.completed) ?? all[0];
      if (target) router.replace(`/learn/${slug}/${target.id}`);
      else setErr("This course has no lectures yet.");
    }).catch((e) => setErr(errMsg(e)));
  }, [slug, router]);
  return (
    <div className="grid min-h-dvh place-items-center p-6 text-center">
      {err ? (
        <div>
          <p className="font-display text-2xl font-bold">You don’t have access to this course right now</p>
          <p className="mx-auto mt-2 max-w-md text-ink-2">If your 12 months of access ended, renew it on the course page: your progress is saved and you continue where you left off.</p>
          <p className="mt-1 text-sm text-muted">{err}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Link href={`/courses/${slug}`} className="btn btn-primary" data-testid="renew-from-player">Renew or view the course</Link>
            <Link href="/student/courses" className="btn btn-outline">My courses</Link>
          </div>
        </div>
      ) : <Loader2 className="size-8 animate-spin text-violet" aria-label="Opening course" />}
    </div>
  );
}
