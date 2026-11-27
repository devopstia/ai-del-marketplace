import { expect, test } from "@playwright/test";
import { login, PASSWORD, USERS } from "./helpers";

/**
 * Quizzes (owner 2026-11-28): shuffled questions and options graded by question, progress, explanations, a practice
 * round on missed questions that is not recorded, bookmarks. Uses the seeded free course the demo student owns.
 */
test.describe.serial("quizzes: shuffle, explanations, retry missed, bookmarks", () => {
  test.skip(!PASSWORD, "Set E2E_PASSWORD (the seed password) to run signed-in flows");
  const RIGHT: Record<string, string> = {
    "400-page runbook": "The text exceeded the context window",
    "cli flag": "Check the official docs or --help",
    "most repeatable": "A prompt with role, context, constraints and an output format",
  };

  test("answers in any order are graded by question; a missed one can be practised again without being recorded", async ({ page }) => {
    await login(page, USERS.student, PASSWORD, "/learn/ai-foundations-for-devops-engineers");
    await page.goto("/learn/ai-foundations-for-devops-engineers");
    const lesson = page.getByText("Check your understanding", { exact: true }).first();
    if (!(await lesson.isVisible())) await page.getByText("Working safely with AI").first().click(); // open its module
    await lesson.click();
    const quiz = page.getByTestId("quiz");
    await expect(quiz).toBeVisible();
    await expect(page.getByTestId("quiz-progress")).toContainText("0 of 3 answered");

    const questions = quiz.getByTestId("quiz-question");
    await expect(questions).toHaveCount(3);
    for (let i = 0; i < 3; i++) {
      const q = questions.nth(i);
      const text = (await q.locator("legend").innerText()).toLowerCase();
      // the "repeatable prompt" question is answered wrong on purpose
      const answer = text.includes("most repeatable") ? '"Fix my pipeline"' : Object.entries(RIGHT).find(([k]) => text.includes(k))![1];
      await q.getByLabel(answer, { exact: true }).check();
    }
    await expect(page.getByTestId("quiz-progress")).toContainText("3 of 3 answered");

    // bookmark a question, filter to it, then remove the bookmark
    const mark = questions.first().getByTestId("quiz-bookmark");
    await mark.click();
    await expect(mark).toHaveAttribute("aria-pressed", "true");
    await page.getByTestId("quiz-only-marked").check();
    await expect(questions).toHaveCount(1);
    await page.getByTestId("quiz-only-marked").uncheck();
    await expect(questions).toHaveCount(3);
    await questions.first().getByTestId("quiz-bookmark").click();
    await expect(questions.first().getByTestId("quiz-bookmark")).toHaveAttribute("aria-pressed", "false");

    await page.getByTestId("quiz-submit").click();
    await expect(page.getByTestId("quiz-result")).toContainText("67% · 2 of 3 correct");
    await expect(quiz.getByTestId("quiz-explanation").first()).toBeVisible();

    await page.getByTestId("quiz-retry-missed").click();
    await expect(page.getByTestId("quiz-kind")).toContainText("Practice");
    await expect(questions).toHaveCount(1);
    await questions.first().getByLabel(RIGHT["most repeatable"]!, { exact: true }).check();
    await page.getByTestId("quiz-submit").click();
    await expect(page.getByTestId("quiz-result")).toContainText("100%");
    await expect(page.getByTestId("quiz-result")).toContainText("not recorded");

    await page.getByTestId("quiz-again").click();
    // a fresh draw and shuffle; the best score counts full attempts only (the practice round didn't change it)
    await expect(page.getByTestId("quiz-progress")).toContainText("0 of 3 answered");
    await expect(page.getByTestId("quiz-progress")).toContainText(/Best score \d+%/);
  });
});
