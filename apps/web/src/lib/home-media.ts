import type { CourseDetail, LectureOutline } from "./types";

/**
 * Still frames taken from DEL's own lesson recordings (apps/web/public/home). Each one is shown only when the lesson it was
 * taken from is still in the live curriculum, and its caption (title, length) comes from that lesson, never from this file.
 */
export const SHOTS = {
  k8sDoctor: { src: "/home/lab-k8s-doctor.jpg", match: /kubernetes doctor agent/i, alt: "The k8s-doctor agent skill open in VS Code" },
  bedrock: { src: "/home/lab-bedrock-assistant.jpg", match: /ai ops chatbot on amazon bedrock/i, alt: "The finished AI ops assistant answering a disk-space question" },
  quiz: { src: "/home/quiz-pod-pending.jpg", match: /kubernetes doctor agent/i, alt: "An end-of-lesson quiz: a pod is Pending with insufficient CPU" },
  ragDocker: { src: "/home/lab-rag-chat.jpg", match: /rag chatbot on docker compose/i, alt: "The RAG chatbot built on Docker Compose answering from company documents" },
  ragAzure: { src: "/home/lab-azure-rag.jpg", match: /rag system on azure/i, alt: "The deployed Azure RAG knowledge assistant" },
  n8n: { src: "/home/lab-n8n-compose.jpg", match: /deploy n8n and mattermost/i, alt: "The Docker Compose file that runs n8n and Mattermost" },
} as const;

export type ShotKey = keyof typeof SHOTS;
export type Shot = { key: ShotKey; src: string; alt: string; lesson: LectureOutline; section: string };

export function findShot(c: CourseDetail | null, key: ShotKey): Shot | null {
  if (!c) return null;
  const s = SHOTS[key];
  for (const sec of c.sections) {
    const lesson = sec.lectures.find((l) => s.match.test(l.title));
    if (lesson) return { key, src: s.src, alt: s.alt, lesson, section: sec.title };
  }
  return null;
}

export function courseFacts(c: CourseDetail) {
  const lectures = c.sections.flatMap((s) => s.lectures);
  return {
    lessons: lectures.length,
    quizzes: lectures.filter((l) => l.hasQuiz).length,
    labs: c.resourceCount ?? 0,
    previews: lectures.filter((l) => l.isPreview),
  };
}
