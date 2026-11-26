import type { MetadataRoute } from "next";
import { SERVER_API_URL } from "@/lib/config";
import { SITE_URL, siteIndexable, topicPath } from "@/lib/seo";

// Built at request time (cached an hour per fetch), so a newly published course appears without a release (docs/SEO.md).
export const dynamic = "force-dynamic";

type Row = Record<string, unknown>;

/** Anonymous API read: no cookies, short timeout, cached an hour. Null when the API is down. */
async function get(path: string): Promise<Row | Row[] | null> {
  try {
    const r = await fetch(`${SERVER_API_URL}${path}`, { headers: { Accept: "application/json" }, next: { revalidate: 3600 }, signal: AbortSignal.timeout(8000) });
    return r.ok ? ((await r.json()) as Row | Row[]) : null;
  } catch {
    return null;
  }
}

const date = (v: unknown) => {
  const d = typeof v === "string" ? new Date(v) : null;
  return d && !Number.isNaN(d.getTime()) ? d : undefined;
};

const PAGE = 48;
const MAX_PAGES = 40; // 1 920 courses; the sitemap format allows 50 000 URLs

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (!siteIndexable()) return [];
  const u = (p: string) => `${SITE_URL}${p}`;
  // Pages that exist whatever the catalogue holds (also the whole sitemap when the API is unreachable).
  const out: MetadataRoute.Sitemap = [
    { url: u("/"), changeFrequency: "daily", priority: 1 },
    { url: u("/courses"), changeFrequency: "daily", priority: 0.9 },
    { url: u("/deals"), changeFrequency: "daily", priority: 0.6 },
    { url: u("/teach"), changeFrequency: "monthly", priority: 0.5 },
    { url: u("/help"), changeFrequency: "weekly", priority: 0.4 },
    { url: u("/contact"), changeFrequency: "yearly", priority: 0.3 },
    { url: u("/install"), changeFrequency: "yearly", priority: 0.2 },
    { url: u("/policies/access-and-refunds"), changeFrequency: "yearly", priority: 0.3 },
    { url: u("/policies/terms"), changeFrequency: "yearly", priority: 0.2 },
    { url: u("/policies/privacy"), changeFrequency: "yearly", priority: 0.2 },
  ];

  const cats = await get("/categories");
  // The API wraps lists as { items: [...] } (older builds returned a bare array).
  const catRows = Array.isArray(cats) ? cats : cats && Array.isArray(cats.items) ? (cats.items as Row[]) : [];
  for (const c of catRows) {
    if (typeof c.slug === "string" && Number(c.courseCount ?? 0) > 0) out.push({ url: u(topicPath(c.slug)), changeFrequency: "weekly", priority: 0.8 });
  }

  // Career paths (docs/CAREER_PATHS.md): the list page only when at least one path is published.
  const paths = await get("/paths");
  const pathRows = Array.isArray(paths) ? paths : paths && Array.isArray(paths.items) ? (paths.items as Row[]) : [];
  if (pathRows.length) out.push({ url: u("/paths"), changeFrequency: "weekly", priority: 0.7 });
  for (const p of pathRows) {
    if (typeof p.slug === "string") out.push({ url: u(`/paths/${encodeURIComponent(p.slug)}`), lastModified: date(p.updatedAt), changeFrequency: "weekly", priority: 0.7 });
  }

  const help = await get("/help/videos");
  const helpCats = help && !Array.isArray(help) && Array.isArray(help.categories) ? (help.categories as Row[]) : [];
  for (const c of helpCats) {
    for (const i of Array.isArray(c.items) ? (c.items as Row[]) : []) {
      if (typeof i.slug === "string") out.push({ url: u(`/help/${encodeURIComponent(i.slug)}`), changeFrequency: "monthly", priority: 0.3 });
    }
  }

  const instructors = new Map<string, Date | undefined>();
  for (let page = 1; page <= MAX_PAGES; page++) {
    const r = await get(`/courses?sort=newest&pageSize=${PAGE}&page=${page}`);
    const items = r && !Array.isArray(r) && Array.isArray(r.items) ? (r.items as Row[]) : [];
    for (const c of items) {
      if (typeof c.slug !== "string") continue;
      const modified = date(c.updatedAt) ?? date(c.publishedAt);
      out.push({ url: u(`/courses/${encodeURIComponent(c.slug)}`), lastModified: modified, changeFrequency: "weekly", priority: 0.9, ...(typeof c.thumbnailUrl === "string" ? { images: [c.thumbnailUrl] } : {}) });
      const id = (c.instructor as Row | undefined)?.id;
      if (typeof id === "string") {
        const prev = instructors.get(id);
        instructors.set(id, prev && modified && prev > modified ? prev : modified ?? prev);
      }
    }
    const totalPages = r && !Array.isArray(r) ? Number(r.totalPages ?? 0) : 0;
    if (items.length < PAGE || page >= totalPages) break;
  }
  for (const [id, lastModified] of instructors) out.push({ url: u(`/instructors/${encodeURIComponent(id)}`), lastModified, changeFrequency: "weekly", priority: 0.6 });
  return out;
}
