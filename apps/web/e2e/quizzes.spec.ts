import { expect, test, type Page } from "@playwright/test";
import { login, PASSWORD, USERS } from "./helpers";

/**
 * Quizzes (owner 2026-11-28): shuffled questions and options graded by question, progress, explanations, a practice
 * round on missed questions that is not recorded, bookmarks. Uses the first quiz of a course the demo student owns
 * (the seeded free course, or the imported catalogue course once the learner has bought it).
 */
async function firstQuiz(page: Page): Promise<{ path: string; tab: boolean } | null> {
  const api = process.env.E2E_API_URL ?? new URL(page.url()).origin.replace(/:(\d+)$/, (_, p) => `:${Number(p) + 1000}`);
  await page.goto("/student/courses");
  await page.waitForLoadState("networkidle");
  const hrefs = await page.locator('a[href^="/learn/"]').evaluateAll((as) => [...new Set(as.map((a) => (a.getAttribute("href") ?? "").split("/")[2]).filter(Boolean))]);
  for (const slug of hrefs) {
    const r = await page.request.get(`${api}/api/me/courses/${slug}`);
    if (!r.ok()) continue;
    const c = (await r.json()) as { sections: { lectures: { id: string; type: string; hasQuiz?: boolean }[] }[] };
    // a quiz lesson, or (imported catalogue) a video lesson with its quiz in the "Quiz" tab
    const all = c.sections.flatMap((s) => s.lectures);
    const q = all.find((l) => l.type === "quiz" && l.hasQuiz !== false) ?? all.find((l) => l.hasQuiz);
    if (q) return { path: `/learn/${slug}/${q.id}`, tab: q.type !== "quiz" };
  }
  return null;
}

test.describe.serial("quizzes: shuffle, explanations, retry missed, bookmarks", () => {
  test.skip(!PASSWORD, "Set E2E_PASSWORD (the seed password) to run signed-in flows");

  test("answers in any order are graded by question; missed ones can be practised again without being recorded", async ({ page }) => {
    await login(page, USERS.student, PASSWORD, "/student/courses");
    const found = await firstQuiz(page);
    test.skip(!found, "the demo student owns no course with a quiz yet");
    await page.goto(found!.path);
    if (found!.tab) await page.getByRole("tab", { name: "Quiz", exact: true }).click();
    const quiz = page.getByTestId("quiz");
    await expect(quiz).toBeVisible();
    const questions = quiz.getByTestId("quiz-question");
    await expect(questions.first()).toBeVisible();
    const n = await questions.count();
    await expect(page.getByTestId("quiz-progress")).toContainText(`0 of ${n} answered`);

    // the last option shown for every question (options are shuffled, so the score varies; grading is by question)
    for (let i = 0; i < n; i++) await questions.nth(i).locator('input[type="radio"]').last().check();
    await expect(page.getByTestId("quiz-progress")).toContainText(`${n} of ${n} answered`);

    // bookmark a question, filter to it, then remove the bookmark
    const mark = questions.first().getByTestId("quiz-bookmark");
    await mark.click();
    await expect(mark).toHaveAttribute("aria-pressed", "true");
    await page.getByTestId("quiz-only-marked").check();
    await expect(questions).toHaveCount(1);
    await page.getByTestId("quiz-only-marked").uncheck();
    await expect(questions).toHaveCount(n);
    await questions.first().getByTestId("quiz-bookmark").click();
    await expect(questions.first().getByTestId("quiz-bookmark")).toHaveAttribute("aria-pressed", "false");

    await page.getByTestId("quiz-submit").click();
    const result = page.getByTestId("quiz-result");
    await expect(result).toContainText(new RegExp(`\\d+% · \\d+ of ${n} correct`));
    await expect(quiz.getByTestId("quiz-explanation").first()).toBeVisible();

    const retry = page.getByTestId("quiz-retry-missed");
    if (await retry.count()) {
      const missed = Number((await retry.innerText()).match(/\d+/)![0]);
      await retry.click();
      await expect(page.getByTestId("quiz-kind")).toContainText("Practice");
      await expect(questions).toHaveCount(missed);
      for (let i = 0; i < missed; i++) await questions.nth(i).locator('input[type="radio"]').first().check();
      await page.getByTestId("quiz-submit").click();
      await expect(result).toContainText("not recorded");
    }

    await page.getByTestId("quiz-again").click();
    // a fresh draw and shuffle; the best score counts full attempts only
    await expect(page.getByTestId("quiz-progress")).toContainText(`0 of ${n} answered`);
    await expect(page.getByTestId("quiz-progress")).toContainText(/Best score \d+%/);
  });
});
