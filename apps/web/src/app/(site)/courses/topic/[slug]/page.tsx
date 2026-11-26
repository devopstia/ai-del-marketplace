import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCategories } from "@/lib/catalog";
import { pageMeta, topicPath } from "@/lib/seo";
import { Catalogue, topicIntro, type SP } from "../../_catalogue";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }>; searchParams: Promise<SP> };

async function topicOf(slug: string) {
  const cats = await getCategories();
  return { cats, topic: cats.find((c) => c.slug === slug) ?? null };
}

/** A topic page Google can index, e.g. /courses/topic/ai-for-devops (docs/SEO.md). */
export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const { topic } = await topicOf(slug);
  if (!topic) return { title: "Topic not found", robots: { index: false } };
  return pageMeta({
    title: `${topic.name} courses`,
    description: topicIntro(topic, topic.courseCount ?? 0),
    path: topicPath(topic.slug),
    // A topic with no published course yet is a thin page: reachable, but not listed in search.
    noindex: !topic.courseCount,
  });
}

export default async function TopicPage({ params, searchParams }: Params) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const { cats, topic } = await topicOf(slug);
  if (!topic) notFound();
  // Only paging and sort apply here; other filters live on /courses.
  return <Catalogue sp={{ page: sp.page, sort: sp.sort }} cats={cats} topic={topic} />;
}
