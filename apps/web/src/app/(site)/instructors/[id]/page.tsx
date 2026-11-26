import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Globe } from "lucide-react";
import { getInstructor } from "@/lib/catalog";
import { Avatar } from "@/components/Avatar";
import { Markdown } from "@/components/Markdown";
import { CourseTile } from "@/components/CourseViews";
import { SocialLinks } from "@/components/SocialLinks";
import { compact } from "@/lib/format";
import { JsonLd } from "@/components/JsonLd";
import { abs, pageMeta, plainText, SAME_AS } from "@/lib/seo";
import { OfficialBadge } from "@/components/OfficialBadge";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const r = await getInstructor(id);
  if (!r) return { title: "Instructor", robots: { index: false } };
  const i = r.instructor;
  const n = r.courses.length;
  const description = plainText(i.headline ? `${i.headline}. ${i.bio ?? ""}` : i.bio) || `${i.name} teaches ${n === 1 ? "1 course" : `${n} courses`} on DevOps Easy Learning.`;
  return {
    ...pageMeta({ title: `${i.name}, instructor`, description, path: `/instructors/${i.id}`, image: r.courses[0]?.thumbnailUrl, imageAlt: i.name, type: "website" }),
    // Profiles without a published course are reachable but not listed in search.
    ...(n ? {} : { robots: { index: false, follow: true } }),
  };
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
  const topics = Array.from(new Set(courses.map((c) => c.category?.name).filter((x): x is string => !!x)));
  const isDel = /devopseasylearning/i.test(i.website ?? "") || i.name === "DevOps Easy Learning";
  const url = abs(`/instructors/${i.id}`);
  // The instructor as a schema.org Person (ProfilePage), with the site's own facts only.
  const personLd = {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    url,
    mainEntity: {
      "@type": "Person",
      "@id": `${url}#person`,
      name: i.name,
      url,
      ...(i.headline ? { jobTitle: i.headline } : {}),
      ...(i.avatarUrl ? { image: abs(i.avatarUrl) } : {}),
      ...(isDel ? { sameAs: SAME_AS } : i.website ? { sameAs: [i.website] } : {}),
    },
  };
  return (
    <div className="container-x pt-12">
      <JsonLd data={personLd} />
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        <div className="min-w-0">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
            <Avatar name={i.name} src={i.avatarUrl} size={112} />
            <div className="min-w-0">
              <p className="text-sm font-bold text-violet">Instructor</p>
              <h1 className="mt-1 font-display text-[clamp(2.2rem,4.6vw,3.4rem)] font-extrabold leading-none tracking-[-0.035em]">{i.name}</h1>
              {i.official ? <OfficialBadge className="mt-3" /> : null}
              {i.headline ? <p className="mt-3 text-lg text-ink-2">{i.headline}</p> : null}
            </div>
          </div>
          <dl className="mt-8 grid grid-cols-2 gap-x-10 gap-y-4 border-y border-line py-5 sm:flex sm:flex-wrap">
            {facts.map(([k, v]) => (
              <div key={k}><dt className="text-sm text-muted">{k}</dt><dd className="font-display text-2xl font-extrabold tabular-nums">{v}</dd></div>
            ))}
          </dl>
          <h2 className="mt-8 font-display text-xl font-bold">About</h2>
          <Markdown source={i.bio || "This instructor hasn’t written a bio yet."} className="prose-del mt-2 max-w-3xl" />
        </div>
        <aside className="self-start rounded-panel border border-line bg-surface p-5 lg:w-[22rem]" aria-label={`About ${i.name}`}>
          {topics.length ? (
            <>
              <h2 className="text-sm font-bold text-ink">Teaches</h2>
              <ul className="mt-2 flex flex-wrap gap-1.5">{topics.map((t) => <li key={t} className="chip">{t}</li>)}</ul>
            </>
          ) : null}
          {i.website ? (
            <a href={i.website} rel="noopener noreferrer" target="_blank" className="btn btn-outline mt-5 w-full"><Globe className="size-4" />{isDel ? "devopseasylearning.com" : "Website"}</a>
          ) : null}
          {isDel ? (
            <>
              <p className="mt-5 text-sm font-bold text-ink">Follow DevOps Easy Learning</p>
              <SocialLinks className="-ml-2 mt-1" />
            </>
          ) : null}
        </aside>
      </div>
      <section className="mt-16">
        <h2 className="mb-6 font-display text-2xl font-extrabold">Courses by {isDel ? i.name : i.name.split(" ")[0]} ({courses.length})</h2>
        {courses.length ? (
          <div className={`grid grid-cols-1 gap-x-4 min-[400px]:grid-cols-2 gap-y-8 sm:gap-x-6 ${courses.length % 3 === 0 && courses.length % 4 !== 0 ? "lg:grid-cols-3" : "lg:grid-cols-4"}`}>{courses.map((c) => <CourseTile key={c.slug} c={c} />)}</div>
        ) : <p className="text-ink-2">No published courses yet.</p>}
      </section>
    </div>
  );
}
