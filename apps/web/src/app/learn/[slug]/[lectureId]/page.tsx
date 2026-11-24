import { LearnPlayer } from "@/components/learn/LearnPlayer";

export default async function LecturePage({ params }: { params: Promise<{ slug: string; lectureId: string }> }) {
  const { slug, lectureId } = await params;
  return <LearnPlayer slug={slug} lectureId={lectureId} />;
}
