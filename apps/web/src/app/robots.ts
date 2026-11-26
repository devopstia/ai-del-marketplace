import type { MetadataRoute } from "next";
import { SITE_URL, siteIndexable } from "@/lib/seo";

// Read at request time: the same image serves production and staging, and only production may be indexed (docs/SEO.md).
export const dynamic = "force-dynamic";

/** Private areas, account pages and the shopping flow stay out of search results. */
const PRIVATE = [
  "/admin", "/studio", "/student", "/learn", "/checkout", "/cart", "/api/",
  "/login", "/register", "/forgot-password", "/reset-password", "/change-password", "/verify-email", "/invite", "/support",
  // Not /certificates: those pages carry their own noindex, which crawlers can only read if they may fetch the page.
];

export default function robots(): MetadataRoute.Robots {
  if (!siteIndexable()) return { rules: [{ userAgent: "*", disallow: "/" }] };
  return {
    // Course covers (/api/media/images/...) stay crawlable: Google and link previews show them.
    rules: [{ userAgent: "*", allow: ["/", "/api/media/images/"], disallow: PRIVATE }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
