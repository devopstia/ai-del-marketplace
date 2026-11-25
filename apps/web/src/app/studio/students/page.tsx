"use client";
import { useState } from "react";
import { useApi } from "@/lib/useApi";
import { list, toStudent, toStudioCourse } from "@/lib/normalize";
import { date } from "@/lib/format";
import { PageHead, DataTable } from "@/components/shell/AppShell";
import { Avatar } from "@/components/Avatar";
import { LoopMeter } from "@/components/LoopMeter";
import { Skeleton } from "@/components/Empty";

const mapStudents = (r: unknown) => list(r, "students", "enrollments").map(toStudent);
const mapCourses = (r: unknown) => list(r, "courses").map(toStudioCourse);

export default function StudentsPage() {
  const [courseId, setCourseId] = useState("");
  const courses = useApi("/instructor/courses", mapCourses);
  const { data, error } = useApi(`/instructor/students${courseId ? `?courseId=${courseId}` : ""}`, mapStudents);
  return (
    <>
      <PageHead title="Students" sub="Learners enrolled in your courses and how far they’ve got."
        actions={
          <select aria-label="Filter by course" className="field !w-auto" value={courseId} onChange={(e) => setCourseId(e.target.value)}>
            <option value="">All courses</option>
            {(courses.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        } />
      {error ? <p className="text-rose">{error}</p> : null}
      {data ? (
        <DataTable head={["Learner", "Course", "Enrolled", "Progress"]} empty={!data.length ? <p className="px-4 py-10 text-center text-ink-2">No students yet. They’ll appear here as soon as someone enrols.</p> : null}>
          {data.map((s) => (
            <tr key={s.id}>
              <td className="px-4 py-3"><span className="flex items-center gap-3"><Avatar name={s.name} size={32} /><span><span className="block font-bold">{s.name}</span>{s.email ? <span className="text-xs text-muted">{s.email}</span> : null}</span></span></td>
              <td className="px-4 py-3">{s.courseTitle}</td>
              <td className="whitespace-nowrap px-4 py-3 text-ink-2">{date(s.enrolledAt)}</td>
              <td className="px-4 py-3">{s.progressPct != null ? <LoopMeter value={s.progressPct} size="sm" /> : "—"}</td>
            </tr>
          ))}
        </DataTable>
      ) : !error ? <Skeleton className="h-80" /> : null}
    </>
  );
}
