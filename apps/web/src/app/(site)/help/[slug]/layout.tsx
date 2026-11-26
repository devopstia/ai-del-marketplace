import type { Metadata } from "next";
import { serverGet } from "@/lib/server-api";
import { toCategories } from "@/lib/help";
import { pageMeta, plainText } from "@/lib/seo";

// Title, description and canonical address for one help video (the page itself is a client component).
// Read from the public list, not the video endpoint, so metadata never opens a playback session.
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const r = await serverGet("/help/videos");
  const item = r.ok ? toCategories(r.data).categories.flatMap((c) => c.items).find((i) => i.slug === slug) : undefined;
  if (!item) return { title: "Help video", alternates: { canonical: `/help/${encodeURIComponent(slug)}` } };
  return pageMeta({ title: item.title, description: plainText(item.summary) || "A short help video for DevOps Easy Learning.", path: `/help/${item.slug}`, image: item.coverUrl, imageAlt: item.title });
}

export default function HelpVideoLayout({ children }: { children: React.ReactNode }) {
  return children;
}
