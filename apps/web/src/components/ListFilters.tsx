"use client";
import { X } from "lucide-react";

export interface FilterOptions { courses: { id: string; title: string; instructorId?: string }[]; instructors?: { id: string; name: string }[] }
export interface FilterValues { instructor?: string; course?: string; from?: string; to?: string }

/**
 * Filter row under a list's tabs: instructor (when offered), course, and an optional "created between" date range.
 * Choosing an instructor narrows the course list to their courses. The parent keeps the values (in the URL).
 */
export function ListFilters({ options, values, onChange, dates = false, label }: {
  options: FilterOptions | null; values: FilterValues; onChange: (v: FilterValues) => void; dates?: boolean; label: string;
}) {
  const courses = (options?.courses ?? []).filter((c) => !values.instructor || !c.instructorId || c.instructorId === values.instructor);
  const active = !!(values.instructor || values.course || values.from || values.to);
  return (
    <div role="group" aria-label={label} className="mt-4 flex flex-wrap items-end gap-x-3 gap-y-2" data-testid="list-filters">
      {options?.instructors ? (
        <div className="w-full sm:w-52">
          <label className="label" htmlFor="flt-instructor">Instructor</label>
          <select id="flt-instructor" className="field" value={values.instructor ?? ""} onChange={(e) => {
            const instructor = e.target.value;
            const keep = !instructor || options.courses.find((c) => c.id === values.course)?.instructorId === instructor;
            onChange({ ...values, instructor, course: keep ? values.course : "" });
          }}>
            <option value="">All instructors</option>
            {options.instructors.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
        </div>
      ) : null}
      <div className="w-full sm:w-64">
        <label className="label" htmlFor="flt-course">Course</label>
        <select id="flt-course" className="field" value={values.course ?? ""} onChange={(e) => onChange({ ...values, course: e.target.value })}>
          <option value="">All courses</option>
          {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          {values.course && !courses.some((c) => c.id === values.course) ? <option value={values.course}>Selected course</option> : null}
        </select>
      </div>
      {dates ? (
        <>
          <div className="w-[calc(50%-0.375rem)] sm:w-auto">
            <label className="label" htmlFor="flt-from">Created from</label>
            <input id="flt-from" type="date" className="field sm:!w-44" value={values.from ?? ""} max={values.to || undefined} onChange={(e) => onChange({ ...values, from: e.target.value })} />
          </div>
          <div className="w-[calc(50%-0.375rem)] sm:w-auto">
            <label className="label" htmlFor="flt-to">to</label>
            <input id="flt-to" type="date" className="field sm:!w-44" value={values.to ?? ""} min={values.from || undefined} onChange={(e) => onChange({ ...values, to: e.target.value })} />
          </div>
        </>
      ) : null}
      {active ? (
        <button type="button" className="btn btn-ghost btn-sm !min-h-11" onClick={() => onChange({ instructor: "", course: "", from: "", to: "" })}>
          <X className="size-4" aria-hidden="true" />Clear filters
        </button>
      ) : null}
    </div>
  );
}
