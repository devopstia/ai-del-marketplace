// Search engines and link previews (docs/SEO.md): the site's public address, whether search engines may index it,
// and the schema.org data Google reads for rich results. Only facts the site already shows go into structured data.
import type { Metadata } from "next";
import type { CourseDetail } from "./types";
import { SOCIAL } from "@/components/SocialLinks";

export const PRODUCTION_URL = "https://ai-devopseasylearning.com";
export const SITE_NAME = "DevOps Easy Learning";
/** Shown by Google under the site name. Only what the site really offers (no labs claim: there are no in-browser labs yet). */
export const SITE_DESCRIPTION =
  "AI and DevOps courses taught by working engineers. Watch on any device and earn a certificate anyone can verify. 12 months of access per course, with a clear refund policy.";

function origin(u: string | undefined): string | null {
  if (!u) return null;
  try { return new URL(u).origin; } catch { return null; }
}

/**
 * The public address of this deployment. WEB_URL is set at runtime on AWS; NEXT_PUBLIC_API_URL is baked in at build
 * time (https://<host>/api), so pages rendered during the build get the right host too.
 */
export const SITE_URL = (origin(process.env.WEB_URL) ?? origin(process.env.NEXT_PUBLIC_API_URL?.replace(/\/api\/?$/, "")) ?? "http://127.0.0.1:3000").replace(/\/$/, "");

/**
 * Only production is indexed. Staging, test and local stacks always say "noindex" (staging's Caddy also sends
 * X-Robots-Tag: noindex). SITE_INDEXABLE=true|false overrides, e.g. for a new production domain.
 */
export function siteIndexable(): boolean {
  const flag = process.env.SITE_INDEXABLE?.trim().toLowerCase();
  if (flag === "false" || flag === "0") return false;
  if (flag === "true" || flag === "1") return true;
  return SITE_URL === PRODUCTION_URL;
}

export const abs = (path: string) => (/^https?:\/\//.test(path) ? path : `${SITE_URL}${path.startsWith("/") ? "" : "/"}${path}`);

const DEFAULT_IMAGE = { url: "/opengraph-image", width: 1200, height: 630, alt: "DevOps Easy Learning: AI and DevOps courses" };

/**
 * A public page's title, description, canonical address and link preview (Open Graph + X card). `image` is an
 * absolute URL (a course cover, 1280×720); without one the site's default preview image is used.
 */
export function pageMeta(o: { title: string; description: string; path: string; image?: string | null; imageAlt?: string; type?: "website" | "article"; noindex?: boolean }): Metadata {
  const images = o.image ? [{ url: abs(o.image), width: 1280, height: 720, alt: o.imageAlt ?? o.title }] : [DEFAULT_IMAGE];
  return {
    title: o.title,
    description: o.description,
    alternates: { canonical: o.path },
    openGraph: { type: o.type ?? "website", siteName: SITE_NAME, locale: "en_US", title: o.title, description: o.description, url: o.path, images },
    twitter: { card: "summary_large_image", site: "@devopseasylearn", title: o.title, description: o.description, images: images.map((i) => i.url) },
    ...(o.noindex ? { robots: { index: false, follow: true } } : {}),
  };
}

export const topicPath =(slug: string) => `/courses/topic/${encodeURIComponent(slug)}`;

/** Plain text for meta descriptions: no markdown, one line, at most `max` characters, cut at a word. */
export function plainText(md: string | null | undefined, max = 160): string {
  const t = (md ?? "").replace(/```[\s\S]*?```/g, " ").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/[#*_`>|-]+/g, " ").replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), max - 20)).replace(/[,.;:\s]+$/, "")}…`;
}

/** ISO 8601 duration (PT1H25M) from seconds; at least one minute. */
export function isoDuration(sec: number): string {
  const m = Math.max(1, Math.round(sec / 60));
  const h = Math.floor(m / 60);
  return `PT${h ? `${h}H` : ""}${m % 60 ? `${m % 60}M` : ""}`;
}

export const SAME_AS = [...SOCIAL.map((s) => s.href), "https://www.devopseasylearning.com/"];

export function organizationLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${SITE_URL}/#organization`,
    name: SITE_NAME,
    url: `${SITE_URL}/`,
    logo: abs("/icons/icon-512.png"),
    email: "support@devopseasylearning.com",
    sameAs: SAME_AS,
  };
}

export function websiteLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    name: SITE_NAME,
    url: `${SITE_URL}/`,
    publisher: { "@id": `${SITE_URL}/#organization` },
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: `${SITE_URL}/courses?q={search_term_string}` },
      "query-input": "required name=search_term_string",
    },
  };
}

export function breadcrumbLd(items: [name: string, path: string][]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map(([name, path], i) => ({ "@type": "ListItem", position: i + 1, name, item: abs(path) })),
  };
}

export function faqLd(items: [q: string, a: string][]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
  };
}

const LEVEL: Record<string, string> = { beginner: "Beginner", intermediate: "Intermediate", advanced: "Advanced" };

/** schema.org Course for Google's course rich results (developers.google.com/search/docs/appearance/structured-data/course-info). */
export function courseLd(c: CourseDetail) {
  const url = abs(`/courses/${c.slug}`);
  const instructor = { "@type": "Person", name: c.instructor.taughtBy || c.instructor.name, url: abs(`/instructors/${c.instructor.id}`), ...(c.instructor.headline ? { description: c.instructor.headline } : {}) };
  const free = c.priceCents === 0;
  return {
    "@context": "https://schema.org",
    "@type": "Course",
    "@id": `${url}#course`,
    name: c.title,
    description: plainText(c.subtitle || c.description, 500),
    url,
    ...(c.thumbnailUrl ? { image: abs(c.thumbnailUrl) } : {}),
    inLanguage: c.language || "en",
    ...(LEVEL[c.level] ? { educationalLevel: LEVEL[c.level] } : {}),
    ...(c.objectives.length ? { teaches: c.objectives } : {}),
    ...(c.requirements.length ? { coursePrerequisites: c.requirements } : {}),
    ...(c.category ? { about: c.category.name } : {}),
    ...(c.publishedAt ? { datePublished: c.publishedAt } : {}),
    ...(c.updatedAt ? { dateModified: c.updatedAt } : {}),
    provider: { "@type": "Organization", name: SITE_NAME, url: `${SITE_URL}/`, sameAs: SAME_AS },
    creator: instructor,
    instructor,
    offers: [{
      "@type": "Offer",
      category: free ? "Free" : "Paid",
      price: (c.priceCents / 100).toFixed(2),
      priceCurrency: (c.currency || "usd").toUpperCase(),
      availability: "https://schema.org/InStock",
      url,
    }],
    hasCourseInstance: [{
      "@type": "CourseInstance",
      courseMode: "Online",
      courseWorkload: isoDuration(c.totalDurationSec),
      instructor,
    }],
    // Only real ratings from enrolled learners (reviews are moderated, never invented).
    ...(c.ratingCount > 0 ? { aggregateRating: { "@type": "AggregateRating", ratingValue: c.ratingAvg.toFixed(1), ratingCount: c.ratingCount, bestRating: 5, worstRating: 1 } } : {}),
  };
}

/** Serialised for a <script type="application/ld+json">: "<" escaped so text can never close the tag. */
export const ldJson = (data: unknown) => JSON.stringify(data).replace(/</g, "\\u003c");
