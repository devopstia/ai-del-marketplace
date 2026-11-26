import { expect, test } from "@playwright/test";
import { login, PASSWORD, USERS } from "./helpers";

// Search inside videos (docs/AI_LEARNING.md): works without an AI key, from the captions' text.
// The seeded free course (owned by the demo student) has a captioned first lesson: "…come from a WebVTT file."
test.describe("search inside videos", () => {
  test.skip(!PASSWORD, "Set E2E_PASSWORD (the seed password) to run signed-in flows");

  test("a learner searches a spoken phrase and the player jumps to that moment, captions still off", async ({ page }) => {
    await login(page, USERS.student, PASSWORD, "/student/courses");
    const hrefs = await page.locator('a[href^="/learn/"]').evaluateAll((as) => [...new Set(as.map((a) => a.getAttribute("href")!.split("/").slice(0, 3).join("/")))]);
    let found = false;
    for (const href of hrefs) {
      await page.goto(href);
      await expect(page.getByRole("tablist", { name: "Lecture" })).toBeVisible();
      if (await page.getByRole("tab", { name: "Search videos" }).count()) { found = true; break; }
    }
    test.skip(!found, "the demo student has no course with captioned videos");

    await page.getByRole("tab", { name: "Search videos" }).click();
    await page.getByTestId("video-search-input").fill("WebVTT");
    const result = page.getByTestId("video-search-result").first();
    await expect(result).toBeVisible();
    await expect(result.locator("mark")).toContainText(/webvtt/i);
    const start = Number(await result.getAttribute("data-start-sec"));
    const lectureId = await result.getAttribute("data-lecture-id");

    await result.click();
    await expect(page).toHaveURL(new RegExp(`/learn/[^/]+/${lectureId}$`));
    const time = () => page.evaluate(() => document.querySelector<HTMLVideoElement>("[data-testid=video-player] video")?.currentTime ?? -1);
    await expect.poll(time, { timeout: 20_000 }).toBeGreaterThanOrEqual(Math.max(0, start - 0.5));
    expect(await time()).toBeLessThan(start + 6);

    // Searching is not a transcript panel: captions stay off until the learner turns them on (rule 11).
    await expect(page.getByRole("button", { name: "Captions" })).toHaveAttribute("aria-pressed", "false");

    // A word nobody says gives a clear empty state.
    await page.getByTestId("video-search-input").fill("zzqqxx");
    await expect(page.getByTestId("video-search-empty")).toBeVisible();
  });
});
