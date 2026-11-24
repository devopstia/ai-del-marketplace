import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Globe } from "lucide-react";
import { getInstructor } from "@/lib/catalog";
import { Avatar } from "@/components/Avatar";
import { Markdown } from "@/components/Markdown";
import { CourseTile } from "@/components/CourseViews";
import { compact } from "@/lib/format";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const r = await getInstructor(id);
  return { title: r ? r.instructor.name : "Instructor" };
}

export default async function InstructorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await getInstructor(id);
  if (!r) notFound();
  const { instructor: i, courses } = r;
  const students = i.studentCount ?? courses.reduce((a, c) => a + c.studentCount, 0);
  const reviews = i.ratingCount ?? courses.reduce((a, c) => a + c.ratingCount, 0);
  const rated = courses.filter((c) => c.ratingCount);
  const rating = i.ratingAvg ?? (rated.length ? rated.reduce((a, c) => a + c.ratingAvg * c.ratingCount, 0) / Math.max(1, reviews) : 0);
  const facts = [
    ["Learners", students ? compact(students) : "—"],
    ["Reviews", reviews ? compact(reviews) : "—"],
    ["Rating", rating ? rating.toFixed(1) : "New"],
    ["Courses", String(courses.length || i.courseCount || 0)],
  ];
  return (
    <div className="container-x pt-12">
      <div className="grid gap-10 lg:grid-cols-[1fr_320px]">
        <div>
          <p className="text-sm font-bold text-violet">Instructor</p>
          <h1 className="mt-2 font-display text-[clamp(2.2rem,4.6vw,3.4rem)] font-extrabold leading-none tracking-[-0.035em]">{i.name}</h1>
          {i.headline ? <p className="mt-3 text-lg text-ink-2">{i.headline}</p> : null}
          <dl className="mt-8 flex flex-wrap gap-x-10 gap-y-4 border-y border-line py-5">
            {facts.map(([k, v]) => (
              <div key={k}><dt className="text-sm text-muted">{k}</dt><dd className="font-display text-2xl font-extrabold tabular-nums">{v}</dd></div>
            ))}
          </dl>
          <h2 className="mt-8 font-display text-xl font-bold">About me</h2>
          <Markdown source={i.bio || "This instructor hasn’t written a bio yet."} className="prose-del mt-2" />
        </div>
        <div className="flex flex-col items-center gap-4 lg:items-start">
          <Avatar name={i.name} src={i.avatarUrl} size={200} />
          {i.website ? <a href={i.website} rel="noopener noreferrer" target="_blank" className="btn btn-outline w-full max-w-[200px]"><Globe className="size-4" />Website</a> : null}
        </div>
      </div>
      <section className="mt-16">
        <h2 className="mb-6 font-display text-2xl font-extrabold">Courses by {i.name.split(" ")[0]} ({courses.length})</h2>
        {courses.length ? (
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-6 lg:grid-cols-4">{courses.map((c) => <CourseTile key={c.slug} c={c} />)}</div>
        ) : <p className="text-ink-2">No published courses yet.</p>}
      </section>
    </div>
  );
}
