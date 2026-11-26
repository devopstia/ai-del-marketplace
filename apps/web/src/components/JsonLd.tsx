import { ldJson } from "@/lib/seo";

/** Structured data for search engines (docs/SEO.md). Server-rendered; nothing visible. */
export function JsonLd({ data }: { data: unknown }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson(data) }} />;
}
