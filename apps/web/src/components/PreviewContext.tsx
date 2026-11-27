"use client";
import { createContext, useContext, useState } from "react";
import { PlayCircle } from "lucide-react";
import type { CourseDetail, LectureOutline } from "@/lib/types";
import { PreviewModal } from "./PreviewModal";

/**
 * The course overview, labelled once (standard §4a, owner 2026-11-28): the intro lesson when the trailer plays its
 * video; otherwise the trailer; with no trailer, the first lesson of the first section when it is the introduction
 * (titled "Welcome…", "Introduction…" or "Course overview…"). A course whose intro isn't recorded yet labels nothing.
 */
export function courseOverviewIds(course?: CourseDetail): string[] {
  if (!course) return [];
  if (course.promoLectureId) return [course.promoLectureId];
  if (course.hasPromo) return ["promo"];
  const first = course.sections[0]?.lectures[0];
  return first && /^(welcome|introduction|course (overview|introduction)|intro\b)/i.test(first.title.trim()) ? [first.id] : [];
}

const Ctx = createContext<(id: string) => void>(() => {});

/**
 * `course` (optional) adds the enrol / start-free action next to the player; the course overview (the intro) is the
 * first lesson of the first section (standard §4a), labelled as such in the player.
 */
export function PreviewProvider({ courseTitle, slug, previews, course, children }: { courseTitle: string; slug: string; previews: LectureOutline[]; course?: CourseDetail; children: React.ReactNode }) {
  const [id, setId] = useState<string | null>(null);
  const overviewIds = courseOverviewIds(course);
  return (
    <Ctx.Provider value={setId}>
      {children}
      <PreviewModal courseTitle={courseTitle} slug={slug} previews={previews} lectureId={id} onClose={() => setId(null)} course={course} overviewIds={overviewIds} />
    </Ctx.Provider>
  );
}

export function PreviewButton({ lectureId, children, className = "link text-sm inline-flex items-center gap-1" }: { lectureId: string; children?: React.ReactNode; className?: string }) {
  const open = useContext(Ctx);
  return (
    <button type="button" className={className} onClick={() => open(lectureId)} data-testid="preview-button">
      {children ?? <><PlayCircle className="size-4" />Preview</>}
    </button>
  );
}
