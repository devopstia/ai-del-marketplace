import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, Tag } from "lucide-react";
import { getCourses, getDeals } from "@/lib/catalog";
import { CourseResultCard } from "@/components/CourseViews";
import { coverSeeds } from "@/components/CourseCover";
import { SaleEnds } from "@/components/SaleEnds";

export const metadata: Metadata = { title: "Deals", description: "AI and DevOps courses on sale right now." };
export const dynamic = "force-dynamic";

export default async function DealsPage() {
  const [deals, res] = await Promise.all([getDeals(), getCourses({ onSale: "1", sort: "discount", pageSize: 48 })]);
  const promos = deals?.promotions ?? [];
  const seeds = coverSeeds(res.items.map((c) => c.slug));
  return (
    <div className="container-x pb-10 pt-8">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-b border-line pb-5">
        <div className="min-w-0">
          <h1 className="font-display text-[clamp(1.9rem,3.6vw,2.8rem)] font-extrabold leading-tight text-ink">Deals</h1>
          <p className="mt-1 text-ink-2">
            {res.total ? `${res.total} ${res.total === 1 ? "course" : "courses"} on sale right now${deals?.maxPercentOff ? `, up to ${deals.maxPercentOff}% off` : ""}. Sale prices end on the date shown.` : "Courses on sale appear here."}
          </p>
        </div>
        {res.total ? <Link href="/courses?onSale=1" className="link inline-flex items-center gap-1 text-sm">Filter and sort deals<ArrowRight className="size-4" /></Link> : null}
      </div>

      {promos.length ? (
        <ul className={`mt-6 grid gap-4 ${promos.length > 1 ? "md:grid-cols-2" : ""}`}>
          {promos.map((p) => (
            <li key={p.id} className="flex items-center gap-4 rounded-panel bg-stage px-5 py-4 text-white">
              <span className="grid size-16 shrink-0 place-items-center rounded-full bg-[#ff9ec2] font-display text-base font-extrabold tabular-nums text-[#141833]">−{p.percentOff}%</span>
              <span className="min-w-0">
                <span className="block font-display text-lg font-bold">{p.name}</span>
                <span className="block text-sm text-white/75">{p.percentOff}% off {p.scope === "all" ? "every course" : "selected courses"} · <SaleEnds endsAt={p.endsAt} className="font-bold text-[#ff9ec2]" /></span>
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {res.items.length ? (
        <div className="mt-8 grid gap-x-8 gap-y-10 sm:grid-cols-2 xl:grid-cols-3">
          {res.items.map((c, i) => <CourseResultCard key={c.slug} c={c} coverSeed={seeds[i]} />)}
        </div>
      ) : (
        <div className="py-20 text-center">
          <Tag className="mx-auto size-10 text-muted" aria-hidden="true" />
          <h2 className="mt-4 font-display text-xl font-bold">No courses are on sale right now</h2>
          <p className="mt-2 text-ink-2">Instructors and DevOps Easy Learning run sales from time to time. Every course has free previews meanwhile.</p>
          <Link href="/courses" className="btn btn-outline mt-6">Browse all courses</Link>
        </div>
      )}
    </div>
  );
}
