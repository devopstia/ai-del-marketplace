import type { Metadata } from "next";
import { getCategories } from "@/lib/catalog";
import { pageMeta, topicPath } from "@/lib/seo";
import { siteShare } from "@/lib/share-server";
import { Catalogue, pickedTopics, type SP } from "./_catalogue";

export const dynamic = "force-dynamic";

/**
 * Search engines index the clean catalogue and the topic pages, not every filter combination: a single topic points
 * to its topic page, other filters and pages to /courses, and search results are not indexed (docs/SEO.md).
 */
export async function generateMetadata({ searchParams }: { searchParams: Promise<SP> }): Promise<Metadata> {
  const sp = await searchParams;
  const topics = pickedTopics(sp);
  const onlyTopic = topics.length === 1 && !sp.q && !sp.level && !sp.price && !sp.onSale ? topics[0]! : null;
  const { image } = await siteShare();
  return pageMeta({
    image,
    title: "Browse AI and DevOps courses",
    description: "Find AI and DevOps courses by topic, level and price. Each course gives 12 months of access and, when you finish, a certificate anyone can verify.",
    path: onlyTopic ? topicPath(onlyTopic) : "/courses",
    noindex: !!sp.q,
  });
}

export default async function CoursesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const [sp, cats] = await Promise.all([searchParams, getCategories()]);
  return <Catalogue sp={sp} cats={cats} />;
}
