import Link from "next/link";
import { ChevronDown, ChevronLeft, ChevronRight, SlidersHorizontal, X } from "lucide-react";
import { getCourses } from "@/lib/catalog";
import { CourseResultCard } from "@/components/CourseViews";
import { coverSeeds } from "@/components/CourseCover";
import { AutoSubmit } from "@/components/AutoSubmit";
import { JsonLd } from "@/components/JsonLd";
import { qs } from "@/lib/qs";
import { breadcrumbLd, topicPath } from "@/lib/seo";
import type { Category } from "@/lib/types";

// The course catalogue: /courses (search and filters) and the topic pages /courses/topic/<slug> (docs/SEO.md).
// Filters always submit to /courses; a topic page is the same list with its topic chosen and its own heading.

const sorts = [
  ["popular", "Most popular"],
  ["rating", "Highest rated"],
  ["newest", "Newest"],
  ["price_asc", "Price: low to high"],
  ["price_desc", "Price: high to low"],
  ["discount", "Biggest discount"],
] as const;
const levels = [["", "All levels"], ["beginner", "Beginner"], ["intermediate", "Intermediate"], ["advanced", "Advanced"]] as const;
const prices = [["", "Any price"], ["free", "Free"], ["paid", "Paid"]] as const;

export type SP = { q?: string; category?: string | string[]; level?: string; price?: string; onSale?: string; sort?: string; page?: string };

/** One filter option. The count is how many courses it would show with the other filters kept; an empty option is disabled. */
function Option({ type, name, value, checked, label, count }: { type: "radio" | "checkbox"; name: string; value: string; checked: boolean; label: string; count?: number }) {
  const empty = count === 0 && !checked;
  return (
    <label className={`flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[0.95rem] ${empty ? "cursor-not-allowed text-muted opacity-60" : "cursor-pointer hover:bg-surface-2"} ${checked ? "font-bold text-ink" : empty ? "" : "text-ink-2"}`}>
      <input type={type} name={name} value={value} defaultChecked={checked} disabled={empty} className="size-4 accent-[var(--violet)]" />
      <span className="min-w-0 flex-1">{label}</span>
      {count !== undefined ? <span className="text-xs font-normal tabular-nums text-muted">{count}</span> : null}
    </label>
  );
}

export const pickedTopics = (sp: SP) => (Array.isArray(sp.category) ? sp.category : sp.category ? sp.category.split(",") : []).filter(Boolean);

/** One honest sentence for a topic page, from its name and course count (categories have no description of their own). */
export const topicIntro = (t: Category, total: number, withName = true) =>
  `${withName ? `${t.name}: ` : ""}${total ? `${total.toLocaleString("en-US")} ${total === 1 ? "course" : "courses"}` : "Courses"} on DevOps Easy Learning. Compare level, length, price and learner ratings, then buy single courses with 12 months of access.`;

export async function Catalogue({ sp: input, cats, topic }: { sp: SP; cats: Category[]; topic?: Category }) {
  const sp: SP = topic ? { ...input, category: topic.slug } : input;
  const page = Math.max(1, Number(sp.page) || 1);
  const picked = pickedTopics(sp);
  const res = await getCourses({ q: sp.q, category: picked, level: sp.level, price: sp.price, onSale: sp.onSale ? "1" : undefined, sort: sp.sort || "popular", page });
  const f = res.facets;
  const seeds = coverSeeds(res.items.map((c) => c.slug));
  const pages = Math.max(1, Math.ceil(res.total / (res.pageSize || 12)));
  const pickedCats = cats.filter((c) => picked.includes(c.slug));
  const heading = topic ? `${topic.name} courses` : sp.onSale && !sp.q && !pickedCats.length ? "Courses on sale" : sp.q ? `Results for “${sp.q}”` : pickedCats.length === 1 ? pickedCats[0]!.name : pickedCats.length === 2 ? pickedCats.map((c) => c.name).join(" and ") : pickedCats.length > 2 ? `${pickedCats.length} topics` : "All courses";
  const base = { ...sp, category: picked, page: undefined };
  const active = [
    sp.q && { key: "q", label: `“${sp.q}”`, href: `/courses${qs({ ...base, q: undefined })}` },
    ...pickedCats.map((c) => ({ key: `cat-${c.slug}`, label: c.name, href: `/courses${qs({ ...base, category: picked.filter((x) => x !== c.slug) })}` })),
    sp.level && { key: "level", label: levels.find((l) => l[0] === sp.level)?.[1] ?? sp.level, href: `/courses${qs({ ...base, level: undefined })}` },
    sp.price && { key: "price", label: sp.price === "free" ? "Free" : "Paid", href: `/courses${qs({ ...base, price: undefined })}` },
    sp.onSale && { key: "onSale", label: "On sale", href: `/courses${qs({ ...base, onSale: undefined })}` },
  ].filter(Boolean) as { key: string; label: string; href: string }[];

  // A topic page pages through its own address; everything else stays on /courses with its filters.
  const pageHref = (p: number) => (topic ? `${topicPath(topic.slug)}${qs({ sort: sp.sort, page: p > 1 ? p : undefined })}` : `/courses${qs({ ...sp, page: p })}`);

  const filters = (
    <AutoSubmit action="/courses" className="space-y-7">
      {sp.q ? <input type="hidden" name="q" value={sp.q} /> : null}
      {sp.sort ? <input type="hidden" name="sort" value={sp.sort} /> : null}
      {f && (f.onSale > 0 || sp.onSale) ? (
        <fieldset>
          <legend className="mb-2 font-display font-bold text-ink">Deals</legend>
          <Option type="checkbox" name="onSale" value="1" checked={!!sp.onSale} label="On sale now" count={f.onSale} />
        </fieldset>
      ) : null}
      <fieldset>
        <div className="mb-2 flex items-baseline justify-between">
          <legend className="font-display font-bold text-ink">Topic</legend>
          {picked.length ? <a href={`/courses${qs({ ...base, category: undefined })}`} className="text-sm font-bold text-violet hover:underline">Clear</a> : null}
        </div>
        {cats.map((c) => <Option key={c.slug} type="checkbox" name="category" value={c.slug} checked={picked.includes(c.slug)} label={c.name} count={f ? f.category[c.slug] ?? 0 : undefined} />)}
      </fieldset>
      <fieldset>
        <legend className="mb-2 font-display font-bold text-ink">Level</legend>
        {levels.map(([v, l]) => <Option key={v} type="radio" name="level" value={v} checked={(sp.level ?? "") === v} label={l} count={f && v ? f.level[v] ?? 0 : undefined} />)}
      </fieldset>
      <fieldset>
        <legend className="mb-2 font-display font-bold text-ink">Price</legend>
        {prices.map(([v, l]) => <Option key={v} type="radio" name="price" value={v} checked={(sp.price ?? "") === v} label={l} count={f && v ? f.price[v] : undefined} />)}
      </fieldset>
      <noscript><button className="btn btn-primary w-full">Apply filters</button></noscript>
    </AutoSubmit>
  );

  return (
    <div className="container-x pb-10 pt-8">
      {topic ? <JsonLd data={breadcrumbLd([["Courses", "/courses"], [topic.name, topicPath(topic.slug)]])} /> : null}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4 border-b border-line pb-5">
        <div className="min-w-0">
          {topic ? (
            <nav aria-label="Breadcrumb" className="mb-2 flex flex-wrap items-center gap-1 text-sm font-bold text-ink-2">
              <Link href="/courses" className="text-violet hover:underline">Courses</Link>
              <ChevronRight className="size-3.5 text-muted" aria-hidden="true" />
              <span aria-current="page">{topic.name}</span>
            </nav>
          ) : null}
          <h1 className="font-display text-[clamp(1.9rem,3.6vw,2.8rem)] font-extrabold leading-tight text-ink">{heading}</h1>
          {!res.ok ? <p className="mt-1 text-ink-2">The catalogue is unavailable right now. Refresh in a minute.</p>
            : topic ? <p className="mt-1 max-w-2xl text-ink-2">{topicIntro(topic, res.total, false)}</p>
            : <p className="mt-1 text-ink-2">{`${res.total.toLocaleString("en-US")} ${res.total === 1 ? "course" : "courses"}`}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <details className="group lg:hidden">
            <summary className="btn btn-outline btn-sm cursor-pointer list-none"><SlidersHorizontal className="size-4" />Filters{active.length ? ` (${active.length})` : ""}</summary>
            <div className="panel absolute left-4 right-4 z-30 mt-2 max-h-[70vh] overflow-y-auto p-5 shadow-float">{filters}</div>
          </details>
          {active.map((a) => (
            <Link key={a.key} href={a.href} className="chip hover:bg-violet-soft" aria-label={`Remove filter ${a.label}`}>
              {a.label}<X className="size-3.5" />
            </Link>
          ))}
          <AutoSubmit action="/courses" className="flex items-center gap-2">
            {sp.q ? <input type="hidden" name="q" value={sp.q} /> : null}
            {picked.map((c) => <input key={c} type="hidden" name="category" value={c} />)}
            {sp.level ? <input type="hidden" name="level" value={sp.level} /> : null}
            {sp.price ? <input type="hidden" name="price" value={sp.price} /> : null}
            {sp.onSale ? <input type="hidden" name="onSale" value="1" /> : null}
            <label htmlFor="sort" className="text-sm text-muted">Sort by</label>
            <span className="relative">
              <select id="sort" name="sort" defaultValue={sp.sort || "popular"} className="field !min-h-9 !w-auto cursor-pointer appearance-none !py-1 !pr-9 text-sm font-bold">
                {sorts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
            </span>
            <noscript><button className="btn btn-sm btn-outline">Sort</button></noscript>
          </AutoSubmit>
        </div>
      </div>

      <div className="mt-6 grid gap-10 lg:grid-cols-[250px_1fr]">
        <aside className="hidden lg:block" aria-label="Filters">{filters}</aside>
        <div className="min-w-0">
          {res.items.length ? (
            <div className="grid gap-x-8 gap-y-10 sm:grid-cols-2">{res.items.map((c, i) => <CourseResultCard key={c.slug} c={c} coverSeed={seeds[i]} priority={i < 2} />)}</div>
          ) : res.ok ? (
            <div className="py-20 text-center">
              <h2 className="font-display text-xl font-bold">No courses match these filters</h2>
              <p className="mt-2 text-ink-2">Try a broader search or remove a filter.</p>
              <Link href="/courses" className="btn btn-outline mt-6">Clear all filters</Link>
            </div>
          ) : null}

          {pages > 1 ? (
            <nav className="mt-8 flex items-center justify-center gap-1" aria-label="Pagination">
              {page > 1 ? <Link className="btn btn-ghost btn-sm" href={pageHref(page - 1)}><ChevronLeft className="size-4" />Previous</Link> : null}
              {Array.from({ length: pages }, (_, i) => i + 1).filter((p) => Math.abs(p - page) < 3 || p === 1 || p === pages).map((p) => (
                <Link key={p} href={pageHref(p)} aria-current={p === page ? "page" : undefined}
                  className={`grid size-9 place-items-center rounded-lg text-sm font-bold ${p === page ? "bg-ink text-paper" : "text-ink-2 hover:bg-surface-2"}`}>{p}</Link>
              ))}
              {page < pages ? <Link className="btn btn-ghost btn-sm" href={pageHref(page + 1)}>Next<ChevronRight className="size-4" /></Link> : null}
            </nav>
          ) : null}
        </div>
      </div>
    </div>
  );
}
