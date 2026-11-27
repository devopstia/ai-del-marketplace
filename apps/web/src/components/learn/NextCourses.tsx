"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { toCourseDetail } from "@/lib/normalize";
import type { RelatedCourse } from "@/lib/types";
import { RelatedCourses } from "../RelatedCourses";

/**
 * The player's recommendation (owner 2026-11-28): shown only under the course's final lesson, in the Overview tab, never
 * over the video. Loads the course's related courses (with `owned` for this learner) once; shows nothing if none.
 */
export function NextCourses({ slug }: { slug: string }) {
  const [items, setItems] = useState<RelatedCourse[] | null>(null);
  useEffect(() => {
    let live = true;
    api(`/courses/${slug}`).then((r) => { if (live) setItems(toCourseDetail(r).related); }).catch(() => { if (live) setItems([]); });
    return () => { live = false; };
  }, [slug]);
  if (!items?.length) return null;
  return <RelatedCourses items={items} variant="compact" className="mt-8" title="Where to go next" intro="You've reached the end of this course. These courses build on it." />;
}
