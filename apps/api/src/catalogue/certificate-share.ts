/**
 * Verified certificate sharing (owner 2026-11-26, idea 8; docs/TRUST.md). Pure helpers so they can be unit tested.
 */
export const ORGANIZATION_NAME = 'DevOps Easy Learning';
/** Same pass mark as the quiz endpoint (learning.service submitQuiz). */
export const QUIZ_PASS_PERCENT = 70;

export function certificateUrl(webUrl: string, code: string): string {
  return `${webUrl.replace(/\/+$/, '')}/certificates/${encodeURIComponent(code)}`;
}

/**
 * LinkedIn "Add licence or certification" link (LinkedIn's documented add-to-profile URL). Fills the form; the learner
 * still confirms on LinkedIn. Only public certificate facts go in it: course title, DEL, issue month, id and link.
 */
export function linkedInAddUrl(p: { courseTitle: string; issuedAt: Date; code: string; certUrl: string }): string {
  const q = new URLSearchParams({
    startTask: 'CERTIFICATION_NAME',
    name: p.courseTitle,
    organizationName: ORGANIZATION_NAME,
    issueYear: String(p.issuedAt.getUTCFullYear()),
    issueMonth: String(p.issuedAt.getUTCMonth() + 1),
    certUrl: p.certUrl,
    certId: p.code,
  });
  return `https://www.linkedin.com/profile/add?${q.toString()}`;
}

/** Best attempt per quiz: how many of the course's quizzes the learner passed, and their average best score. */
export function quizSummary(quizIds: string[], attempts: { quizId: string; score: number }[]): { total: number; passed: number; averageBest: number | null } | null {
  if (!quizIds.length) return null;
  const best = new Map<string, number>();
  for (const a of attempts) if (quizIds.includes(a.quizId)) best.set(a.quizId, Math.max(best.get(a.quizId) ?? 0, a.score));
  const scores = quizIds.map((id) => best.get(id)).filter((s): s is number => s !== undefined);
  return {
    total: quizIds.length,
    passed: scores.filter((s) => s >= QUIZ_PASS_PERCENT).length,
    averageBest: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
  };
}
