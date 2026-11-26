import { test, type Page } from "@playwright/test";
import { apiFromPage, expect, freshCode, login, logout, PASSWORD, rememberSeed, tinyVideo, USERS, visible, watchApiBase } from "./helpers";

const PAID_COURSE = process.env.E2E_COURSE_SLUG || "ai-for-devops";

test.describe("public catalogue", () => {
  test("home shows the hero and the catalogue", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Learn AI and DevOps");
    // Small catalogue: one course shown as a route; larger catalogue: categories and course rails.
    const route = page.getByTestId("course-path");
    if (await route.count()) {
      await expect(route.getByRole("list", { name: "Course route" })).toBeVisible();
      await route.getByTestId("path-view-course").click();
      await expect(page).toHaveURL(/\/courses\//);
    } else {
      await expect(page.getByRole("navigation", { name: "Categories" })).toBeVisible();
      await expect(page.getByTestId("course-tile").first()).toBeVisible();
    }
  });

  test("home: a free lesson plays without signing in", async ({ page }) => {
    await page.goto("/");
    const route = page.getByTestId("course-path");
    test.skip(!(await route.count()), "only when the home page shows a single course route");
    await route.getByRole("button", { name: "Watch a free lesson" }).click();
    await expect(page.getByRole("dialog").getByTestId("video-player")).toBeVisible();
  });

  test("course page shows the purchase card, curriculum and a free preview", async ({ page }) => {
    await page.goto(`/courses/${PAID_COURSE}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(visible(page, "purchase-card")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Course content" })).toBeVisible();
    await page.getByTestId("preview-button").filter({ visible: true }).first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByTestId("video-player")).toBeVisible();
    await expect.poll(() => dialog.locator("video").getAttribute("src")).toContain("http");
  });

  test("the home page search finds courses (no popular-search chips, owner 2026-11-25)", async ({ page }) => {
    // a word from a real course title, so this works on any catalogue (local demo or staging)
    await page.goto("/courses");
    const title = (await page.getByTestId("course-row").first().innerText()).split("\n").find((l) => l.trim().length > 12) ?? "";
    const word = title.split(/\s+/).find((w) => /^[A-Za-z]{5,}$/.test(w)) ?? "DevOps";
    await page.goto("/");
    await expect(page.getByText("Popular:")).toHaveCount(0);
    const hero = page.locator("main").getByRole("search");
    await hero.getByLabel("Search courses").fill(word);
    await hero.getByRole("button", { name: "Search" }).click();
    await expect(page).toHaveURL(new RegExp(`/courses\\?q=${word}`));
    await expect(page.getByTestId("course-row").first()).toBeVisible();
  });

  test("search filters the catalogue", async ({ page }) => {
    await page.goto("/courses?q=MCP");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("MCP");
    await expect(page.getByTestId("course-row").first()).toBeVisible();
  });

  test("protected pages send signed-out visitors to log in", async ({ page }) => {
    await page.goto("/student");
    await expect(page).toHaveURL(/\/login\?next=%2Fstudent/);
    // old links still work: /my-learning moved into the Student Studio
    await page.goto("/my-learning");
    await expect(page).toHaveURL(/\/login\?next=%2Fstudent%2Fcourses/);
  });
});

test.describe.serial("learner buys and studies a course", () => {
  const email = `e2e-${Date.now()}@example.com`;
  const password = "e2e-garden-path-4821";

  test("register", async ({ page }) => {
    await page.goto("/register");
    await page.getByLabel("Full name").fill("E2E Learner");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await expect(page.getByTestId("password-rules")).toContainText("At least 12 characters");
    await page.getByTestId("auth-submit").click();
    // Every account sets up Google Authenticator before the first session.
    await expect(page).toHaveURL(/\/login\/verify/);
    const secret = (await page.getByTestId("mfa-secret").innerText()).replace(/\s/g, "");
    rememberSeed(email, secret);
    await expect(page.getByTestId("mfa-qr")).toBeVisible();
    await page.getByTestId("mfa-code").fill(await freshCode(email));
    await page.getByTestId("mfa-submit").click();
    await expect(page.getByTestId("recovery-codes")).toBeVisible();
    await expect(page.getByTestId("codes-continue")).toBeDisabled();
    await page.getByTestId("codes-saved").check();
    await page.getByTestId("codes-continue").click();
    await expect(page).toHaveURL(/\/student$/);
    await expect(page.getByRole("heading", { name: /^Welcome/ })).toBeVisible();
  });

  test("buy with the local test payment and land in My learning", async ({ page }) => {
    await login(page, email, password, `/courses/${PAID_COURSE}`);
    await expect(page).toHaveURL(new RegExp(`/courses/${PAID_COURSE}`));
    await visible(page, "buy-now").click();
    await expect(page).toHaveURL(/\/checkout$/);
    // Terms acceptance (owner 2026-11-26): nothing can be paid before the box is ticked; the API records the version.
    const consent = page.locator("label").filter({ has: page.getByTestId("consent") });
    await expect(consent).toContainText("Terms of use");
    await expect(consent).toContainText("Access and refunds policy");
    await expect(page.getByTestId("pay")).toBeDisabled();
    await page.getByTestId("consent").check();
    await expect(page.getByTestId("pay")).toBeEnabled();
    await page.getByTestId("pay").click();
    // Without Stripe keys the API returns the dev test-payment page
    await expect(page).toHaveURL(/\/checkout\/test|checkout\.stripe\.com/);
    test.skip(page.url().includes("stripe.com"), "Stripe test mode is configured; card entry is out of scope for the smoke test");
    await page.getByTestId("complete-test-payment").click();
    await expect(page.getByTestId("checkout-success")).toHaveText("You’re enrolled");
    await page.goto("/student/courses");
    await expect(page.getByTestId("learning-item").first()).toBeVisible();
    // The receipt shows which terms were accepted and when.
    await page.goto("/student/purchases");
    await page.locator('a[href^="/student/purchases/"]').filter({ visible: true }).first().click();
    await expect(page.getByTestId("receipt-terms")).toContainText(/version \d{4}-\d{2}-\d{2}/);
  });

  test("play a lecture with a signed URL", async ({ page }) => {
    await login(page, email, password, `/learn/${PAID_COURSE}`);
    await expect(page).toHaveURL(new RegExp(`/learn/${PAID_COURSE}/[\\w-]+`));
    await expect(page.getByTestId("video-player")).toBeVisible();
    await expect.poll(() => page.locator("video").getAttribute("src")).toContain("http");
    await expect(page.getByRole("navigation", { name: "Course content" }).first()).toBeAttached();
  });
  test("rate and review the course without leaving the player", async ({ page }) => {
    await login(page, email, password, `/learn/${PAID_COURSE}`);
    await page.getByTestId("open-review").click();
    const panel = page.getByTestId("review-panel");
    await expect(panel.getByTestId("course-rating")).toBeVisible();
    await panel.getByTestId("star-4").click();
    await panel.getByTestId("review-body").fill("Labs worked first time on my laptop.");
    await panel.getByTestId("review-save").click();
    await expect(panel.getByTestId("my-review")).toContainText("Labs worked first time");
    // Edit: one review per student, updated in place.
    await panel.getByTestId("review-edit").click();
    await panel.getByTestId("star-5").click();
    await panel.getByTestId("review-save").click();
    await expect(panel.getByTestId("my-review")).toContainText("Excellent");
    await page.goto(`/courses/${PAID_COURSE}`);
    await expect(page.locator("#reviews")).toContainText("Labs worked first time");
  });
  test("refund from the receipt (within 14 days, little watched)", async ({ page }) => {
    await login(page, email, password, "/student/purchases");
    // sign-in finishes with a full page load: wait for it before moving on
    await page.waitForURL(/\/student\/purchases$/);
    const receipt = page.getByRole("link", { name: "Receipt" }).first();
    await expect(receipt).toBeVisible();
    await page.goto((await receipt.getAttribute("href"))!);
    await expect(page.getByRole("heading", { name: "Receipt" })).toBeVisible();
    const panel = page.getByTestId("refund-panel");
    await expect(panel).toContainText("within 14 days");
    await panel.getByRole("checkbox").first().check();
    await panel.getByTestId("request-refund").click();
    await page.getByTestId("confirm-learner-refund").click();
    await expect(page.getByText(/Refund issued/)).toBeVisible();
  });
});

test.describe.serial("instructor publishes, admin approves", () => {
  test.skip(!PASSWORD, "Set E2E_PASSWORD (the seed password) to run instructor/admin flows");
  const title = `E2E course ${Date.now()}`;

  test("instructor creates a course and submits it for review", async ({ page }) => {
    const video = tinyVideo();
    test.skip(!video, "ffmpeg is needed to generate a test video");
    await login(page, USERS.instructor, PASSWORD, "/studio/courses");
    await page.getByTestId("new-course").click();
    await page.getByLabel("Working title").fill(title);
    await page.getByLabel("Category").selectOption({ index: 1 });
    await page.getByTestId("create-course").click();
    await expect(page).toHaveURL(/\/studio\/courses\/[\w-]+$/);

    await page.getByLabel("Subtitle").fill("A smoke-test course created by Playwright");
    await page.getByLabel("Description").fill("This course is created automatically by the end-to-end smoke test. It has one section and one short video lecture.");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText("Details saved.")).toBeVisible();

    await page.getByRole("link", { name: /Curriculum/ }).click();
    await page.getByLabel("New section title").fill("Getting started");
    await page.getByTestId("add-section").click();
    await expect(page.getByLabel("Section 1 title")).toHaveValue("Getting started");
    await page.getByLabel("New lesson title").fill("Welcome");
    await page.getByTestId("add-lecture").click();
    // The video goes in straight from the lesson's row (curriculum editor, owner 2026-11-25).
    const row = page.getByTestId("lesson-row").filter({ hasText: "Welcome" });
    await expect(row.getByText("No video yet")).toBeVisible();
    await page.getByLabel("Video for Welcome").setInputFiles(video!);
    await expect(page.getByText(/uploaded\. Processing has started/)).toBeVisible({ timeout: 60_000 });
    // ready = the preview link appears and the status badge goes away
    await expect(page.getByLabel("Preview Welcome")).toBeVisible({ timeout: 90_000 });

    await page.getByRole("link", { name: /Review and submit/ }).click();
    await page.getByTestId("submit-review").click();
    await expect(page.getByText("In review", { exact: true }).first()).toBeVisible();
  });

  test("admin approves the course", async ({ page }) => {
    await logout(page);
    await login(page, USERS.admin, PASSWORD, "/admin/review");
    await page.getByRole("button", { name: new RegExp(title) }).click();
    await page.getByTestId("admin-approve").click();
    await expect(page.getByText("Course approved and published.")).toBeVisible();
    await page.goto(`/courses?q=${encodeURIComponent(title)}`);
    await expect(page.getByTestId("course-row").first()).toContainText(title);
  });

  const subtitle = `Updated by Playwright ${Date.now()}`;

  test("instructor edits the live course and submits the changes", async ({ page }) => {
    await logout(page);
    await login(page, USERS.instructor, PASSWORD, "/studio/courses");
    await page.getByRole("link", { name: title }).first().click();
    await expect(page.getByText("This course is live.")).toBeVisible();
    await page.getByLabel("Subtitle").fill(subtitle);
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText("Details saved.").first()).toBeVisible();
    await expect(page.getByText(/You have unsubmitted changes/)).toBeVisible();
    // Learners still see the live version.
    const slug = await page.getByRole("link", { name: "View live page" }).getAttribute("href");
    await page.getByRole("link", { name: /Review and submit/ }).first().click();
    await expect(page.getByTestId("revision-changes")).toContainText("Subtitle");
    await page.getByTestId("submit-review").click();
    await expect(page.getByText(/Editing is paused while an admin reviews your changes/)).toBeVisible();
    await page.goto(slug!);
    await expect(page.getByText(subtitle)).toHaveCount(0);
  });

  test("admin reviews the changes and approves them", async ({ page }) => {
    await logout(page);
    await login(page, USERS.admin, PASSWORD, "/admin/review");
    await page.getByRole("button", { name: new RegExp(title) }).click();
    await expect(page.getByText("Changes to a live course")).toBeVisible();
    await expect(page.getByTestId("review-changes")).toContainText("Subtitle");
    await page.getByTestId("admin-approve").click();
    await expect(page.getByText("Changes approved. They are live now.")).toBeVisible();
    await page.goto(`/courses?q=${encodeURIComponent(title)}`);
    await page.getByTestId("course-row").first().click();
    await expect(page.getByText(subtitle).first()).toBeVisible();
  });

  test("admin Money page reconciles and DEL Studio switch works", async ({ page }) => {
    await logout(page);
    await login(page, USERS.admin, PASSWORD, "/admin/finance");
    await expect(page.getByRole("heading", { name: "Money" })).toBeVisible();
    await expect(page.getByText(/paid orders add up/)).toBeVisible();
    // the studio switcher lists only the studios this account may open
    await visible(page, "studio-switcher").click();
    await expect(page.getByTestId("switch-instructor")).toHaveCount(0);
    await page.getByTestId("switch-del").click();
    await expect(page.getByTestId("acting-banner")).toContainText("DevOps Easy Learning");
    await page.goto("/studio/sales");
    await expect(page.getByTestId("terms-note")).toContainText("DEL");
    await expect(page.getByTestId("breadcrumbs")).toContainText("DEL Studio");
    await visible(page, "studio-switcher").click();
    await page.getByTestId("switch-admin").click();
    await expect(page).toHaveURL(/\/admin$/);
    // never trapped: back to the marketplace from any studio
    await visible(page, "back-to-marketplace").click();
    await expect.poll(() => new URL(page.url()).pathname).toBe("/");
  });

  test("role changes need the authenticator code and show what changes", async ({ page }) => {
    await logout(page);
    await login(page, USERS.admin, PASSWORD, "/admin/users");
    await expect(page.getByTestId("user-stats")).toContainText("Registered users");
    await page.getByLabel("Search users").fill("nadia");
    await page.getByTestId("user-row").filter({ hasText: "nadia@instructor.example" }).getByTestId("manage-user").click();
    const dialog = page.getByTestId("manage-dialog");
    await dialog.getByTestId("role-admin").check();
    await expect(dialog.getByTestId("perm-users.view")).toBeVisible();
    await expect(dialog.getByTestId("confirm-access")).toContainText("Adding Admin");
    await expect(dialog.getByTestId("save-access")).toBeDisabled(); // needs the six-digit code
    await expect(dialog.getByTestId("stepup-code")).toBeVisible();
    await page.keyboard.press("Escape");
  });
});

test.describe.serial("sales and promotions", () => {
  test.skip(!PASSWORD, "Set E2E_PASSWORD (the seed password) to run instructor/admin flows");
  let title = "";

  test("instructor puts a published course on sale from the studio", async ({ page }) => {
    await login(page, USERS.instructor, PASSWORD, "/studio/promotions");
    const pick = page.getByTestId("promo-course").filter({ has: page.getByText("published", { exact: true }) }).filter({ has: page.getByTestId("put-on-sale") }).first();
    title = (await pick.getByRole("link").first().innerText()).trim();
    // The "Put on sale" button goes away once the form opens, so keep hold of the row by its title.
    const row = page.getByTestId("promo-course").filter({ hasText: title });
    await row.getByTestId("put-on-sale").click();
    await row.getByRole("button", { name: "−20%" }).click();
    await row.getByRole("button", { name: "3 days" }).click();
    await row.getByTestId("save-sale").click();
    await expect(row.getByText("Running")).toBeVisible();
  });

  test("learners see the sale: crossed-out price on Deals and the course page", async ({ page }) => {
    await logout(page);
    await page.goto("/deals");
    const card = page.getByTestId("course-row").filter({ hasText: title });
    // −20% unless a bigger marketplace promotion is running (lowest price wins).
    await expect(card).toContainText(/−\d+%/);
    await expect(card.locator("s")).toBeVisible();
    await expect(page.getByRole("link", { name: /^Deals/ }).first()).toBeVisible();
    await card.click();
    await expect(page.getByTestId("course-price").first()).toContainText("Regular price");
  });

  test("super admin runs and cancels a marketplace promotion", async ({ page }) => {
    await logout(page);
    await login(page, USERS.admin, PASSWORD, "/admin/promotions");
    await page.getByTestId("new-promo").click();
    const name = `E2E sale ${Date.now()}`;
    await page.getByLabel("Name learners see").fill(name);
    await page.getByLabel("Discount").fill("15");
    await page.getByRole("button", { name: "3 days" }).click();
    await page.getByTestId("save-promo").click();
    const row = page.getByRole("row").filter({ hasText: name });
    await expect(row.getByText("Running")).toBeVisible();
    await page.goto("/deals");
    await expect(page.getByText(name).first()).toBeVisible();
    await page.goto("/admin/promotions");
    await row.getByRole("button", { name: "Cancel" }).click();
    await row.getByRole("button", { name: "Yes, cancel" }).click();
    await expect(row.getByText("Cancelled")).toBeVisible();
  });

  test("instructor cancels the sale and the regular price returns", async ({ page }) => {
    await logout(page);
    await login(page, USERS.instructor, PASSWORD, "/studio/promotions");
    const row = page.getByTestId("promo-course").filter({ hasText: title });
    await row.getByRole("button", { name: "Cancel sale" }).click();
    await row.getByTestId("confirm-cancel-sale").click();
    await expect(row.getByTestId("put-on-sale")).toBeVisible();
  });
});

test.describe.serial("standard course covers", () => {
  test.skip(!PASSWORD, "Set E2E_PASSWORD (the seed password) to run instructor/admin flows");

  test("instructor picks a new cover in the studio and it is saved", async ({ page }) => {
    await login(page, USERS.instructor, PASSWORD, "/studio/courses");
    await page.locator('a[href^="/studio/courses/"]').filter({ hasNot: page.locator('[href="/studio/courses/new"]') }).first().click();
    await page.waitForURL(/\/studio\/courses\/[0-9a-f-]{36}/);
    await page.goto(page.url().split("?")[0] + "?step=media");
    const picker = page.getByTestId("cover-picker");
    await expect(picker).toBeVisible();
    const before = await page.getByTestId("cover-preview").getAttribute("src");
    await picker.getByRole("tab", { name: "Generic", exact: true }).click();
    const option = picker.getByTestId("cover-option").filter({ hasNot: page.getByText("Current") }).first();
    await option.click();
    await page.getByTestId("save-cover").click();
    await expect(page.getByTestId("save-cover")).toHaveCount(0);
    await expect.poll(async () => page.getByTestId("cover-preview").getAttribute("src")).not.toBe(before);
    expect(await page.getByTestId("cover-preview").evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  });

  test("admin sees every cover template", async ({ page }) => {
    await logout(page);
    await login(page, USERS.admin, PASSWORD, "/admin/covers");
    await expect(page.getByTestId("template-card").first()).toBeVisible();
    expect(await page.getByTestId("template-card").count()).toBeGreaterThanOrEqual(52);
  });
});

test.describe.serial("support center", () => {
  test.skip(!PASSWORD, "Set E2E_PASSWORD (the seed password) to run signed-in flows");
  let number = "";

  test("a student opens a request", async ({ page }) => {
    await login(page, USERS.student, PASSWORD, "/support/new");
    await page.getByTestId("ticket-category").selectOption("technical");
    await page.getByTestId("ticket-subject").fill(`E2E help ${Date.now()}`);
    await page.getByTestId("composer-text").fill("The page does not load after I sign in.");
    await page.getByTestId("composer-send").click();
    await page.waitForURL(/\/support\/SUP-\d{6}$/);
    number = page.url().split("/").pop()!;
    await expect(page.getByTestId("ticket-thread")).toContainText("does not load");
  });

  test("support staff answer from the queue", async ({ page }) => {
    await logout(page);
    await login(page, USERS.admin, PASSWORD, `/admin/support/${number}`);
    await page.getByRole("tab", { name: "Resolve" }).click();
    await page.getByTestId("composer-text").fill("Fixed, please try again.");
    await page.getByTestId("composer-send").click();
    await expect(page.getByTestId("ticket-thread")).toContainText("Marked as resolved");
  });

  test("the student confirms it is solved", async ({ page }) => {
    await logout(page);
    await login(page, USERS.student, PASSWORD, `/support/${number}`);
    await page.getByTestId("confirm-resolved").click();
    await expect(page.getByText("Still having this problem?")).toBeVisible();
  });
});

test.describe("content protection", () => {
  test.skip(!PASSWORD, "Set E2E_PASSWORD (the seed password) to run signed-in flows");
  test("an enrolled learner watches encrypted video with no file link and nothing written on it", async ({ page }) => {
    const mp4: string[] = [];
    page.on("request", (r) => { if (/\.mp4(\?|$)/.test(r.url())) mp4.push(r.url()); });
    await login(page, USERS.student, PASSWORD, "/student/courses");
    const href = await page.locator('a[href^="/learn/"]').first().getAttribute("href");
    const key = page.waitForResponse((r) => r.url().endsWith("/key") && r.status() === 200);
    await page.goto(href!);
    const player = page.getByTestId("video-player");
    await expect(player).toHaveAttribute("data-protected", "true");
    await expect(page.getByTestId("video-watermark")).toHaveCount(0);
    await key;
    await expect.poll(() => page.evaluate(() => document.querySelector<HTMLVideoElement>("[data-testid=video-player] video")!.readyState), { timeout: 15_000 }).toBeGreaterThanOrEqual(2);
    expect(mp4).toEqual([]);
    // Captions stay off until the learner turns them on (rule 11).
    await expect(page.getByRole("button", { name: "Captions" })).toHaveAttribute("aria-pressed", "false");
  });
});

test.describe.serial("help videos", () => {
  test.skip(!PASSWORD, "Set E2E_PASSWORD (the seed password) to run signed-in flows");
  const title = `E2E help video ${Date.now()}`;
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-");

  test("an admin uploads and publishes a help video", async ({ page }) => {
    const video = tinyVideo();
    test.skip(!video, "ffmpeg is needed to make a test video");
    await login(page, USERS.admin, PASSWORD, "/admin/help");
    await page.getByTestId("new-help-video").click();
    const form = page.getByTestId("help-editor");
    await form.getByLabel("Title").fill(title);
    await form.getByLabel("Summary").fill("A short test of the help videos page.");
    await form.locator('input[type="file"]').first().setInputFiles(video!);
    await page.getByTestId("help-save").click();
    const row = page.getByTestId("help-admin-list").locator("li").filter({ hasText: title });
    await expect(row).toBeVisible();
    // The worker probes the file; reload until it is ready, then publish.
    await expect.poll(async () => {
      await page.reload();
      await row.waitFor();
      return row.getByTestId("help-publish").count();
    }, { timeout: 60_000, intervals: [2000] }).toBe(1);
    await row.getByTestId("help-publish").click();
    await expect(row).toContainText("Published");
  });

  test("anyone can watch it from /help, captions off", async ({ page }) => {
    await page.goto("/help");
    // playlist + player on one page (owner chose option B): the video plays here, the link stays shareable
    await page.getByTestId("help-row").filter({ hasText: title }).click();
    await expect(page).toHaveURL(new RegExp(`/help\\?v=${slug}$`));
    await expect(page.getByTestId("help-watch").getByRole("heading", { level: 2 })).toHaveText(title);
    await expect(page.getByTestId("video-player")).toBeVisible();
    await expect(page.getByRole("button", { name: "Captions" })).toHaveCount(0); // no captions until a file exists, never on by default
    await expect(page.getByRole("link", { name: "Ask support" })).toHaveAttribute("href", /\/support\/new\?category=other/);
    // the single-video page still works for old links
    await page.goto(`/help/${slug}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
  });

  test("the admin removes it", async ({ page }) => {
    await login(page, USERS.admin, PASSWORD, "/admin/help");
    page.once("dialog", (d) => void d.accept());
    await page.getByRole("button", { name: `Delete ${title}` }).click();
    await expect(page.getByText(title)).toHaveCount(0);
  });
});

test("12 months of access is disclosed before paying, never lifetime", async ({ page }) => {
  await page.goto(`/courses/${PAID_COURSE}`);
  const card = page.locator("[data-testid=purchase-card]:visible").first();
  await expect(card).toContainText("12 months of access");
  await expect(page.locator("body")).not.toContainText(/lifetime access|for life\b/i);
  // the FAQ answer is in a closed <details>: read its text, not just what is visible
  const faq = await page.locator("#faq-h").locator("..").textContent();
  expect(faq ?? "").toContain("12 months from the day you buy it");
  expect(faq ?? "").not.toMatch(/for life|lifetime|less than 25/i);
  await page.goto("/policies/access-and-refunds");
  await expect(page.getByTestId("policy")).toContainText("12 months from the day you buy it");
  await expect(page.getByTestId("policy")).toContainText("25% or less");
});


test.describe("studios, contact and platform videos (owner 2026-11-25)", () => {
  test.skip(!PASSWORD, "Set E2E_PASSWORD (the seed password) to run signed-in flows");

  test("Student Studio: real dashboard, collapsible sidebar, breadcrumbs, back to the marketplace", async ({ page }) => {
    await login(page, USERS.student, PASSWORD, "/student");
    await expect(page.getByRole("heading", { name: /^Welcome/ })).toBeVisible();
    await expect(page.getByTestId("nav-platform-videos").first()).toHaveAttribute("href", "/help");
    await visible(page, "nav-my-courses").click();
    await expect(page).toHaveURL(/\/student\/courses$/);
    await expect(page.getByTestId("breadcrumbs")).toContainText("Student Studio");
    await expect(page.getByTestId("breadcrumbs")).toContainText("My courses");
    await page.getByTestId("studio-back").click();
    await expect(page).toHaveURL(/\/student$/);
    await page.getByTestId("sidebar-toggle").click();
    await expect(page.locator("[data-sidebar]")).toHaveAttribute("data-sidebar", "collapsed");
    await page.getByTestId("sidebar-toggle").click();
    await page.getByTestId("topbar-marketplace").click();
    await expect.poll(() => new URL(page.url()).pathname).toBe("/");
  });

  test("lesson player: previous and next live in the control bar", async ({ page }) => {
    await login(page, USERS.student, PASSWORD, "/student/courses");
    const href = await page.locator('a[href^="/learn/"]').first().getAttribute("href");
    await page.goto(href!);
    await expect(page.getByTestId("player-next")).toBeVisible();
    await expect(page.getByTestId("player-prev")).toBeAttached();
  });

  test("contact page sends a message with a screenshot", async ({ page }) => {
    await page.goto("/contact");
    await expect(page.getByTestId("social-links").first()).toBeVisible();
    await page.getByLabel("Your name").fill("E2E Visitor");
    await page.locator("#c-email").fill(`e2e-contact-${Date.now()}@example.com`);
    await page.getByLabel("Subject").fill("Mobile money payment");
    await page.getByLabel("Message").fill("Can I pay for a course with mobile money from Cameroon?");
    const png = Buffer.from("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8ffff3f0005fe02fea7d6a4c50000000049454e44ae426082", "hex");
    await page.getByTestId("contact-file").setInputFiles({ name: "screen.png", mimeType: "image/png", buffer: png });
    await page.getByTestId("contact-submit").click();
    await expect(page.getByTestId("contact-sent")).toContainText(/C-\d+/);
  });

  test("platform videos page and the DEL full program links", async ({ page }) => {
    await page.goto("/help");
    await expect(page.getByRole("heading", { name: "Platform videos", exact: true })).toBeVisible();
    await page.goto("/");
    await expect(page.getByTestId("program-enroll")).toHaveAttribute("href", /^https:\/\/www\.devopseasylearning\.com\/registration\//);
    await expect(page.getByRole("navigation", { name: "Main" }).getByText("Full program")).toHaveCount(0);
  });
});

test.describe.serial("guest cart: shop first, sign up only at checkout (owner 2026-11-25)", () => {
  const email = `e2e-guest-${Date.now()}@example.com`;
  test("a visitor adds courses, keeps them after a refresh, and signs up at checkout without losing them", async ({ page }) => {
    await page.goto(`/courses/${PAID_COURSE}`);
    await expect(page).not.toHaveURL(/\/login/);
    await visible(page, "add-to-cart").click();
    await expect(page).not.toHaveURL(/\/login/);
    await page.goto("/cart");
    await expect(page.getByTestId("cart-item")).toHaveCount(1);
    await page.reload();
    await expect(page.getByTestId("cart-item")).toHaveCount(1);
    await page.getByTestId("checkout").click();
    await expect(page).toHaveURL(/\/register\?next=%2Fcheckout/);
    await page.getByLabel("Full name").fill("Guest Shopper");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password", { exact: true }).fill("river-stone-meadow-4821");
    await page.getByTestId("auth-submit").click();
    await expect(page).toHaveURL(/\/login\/verify/);
    rememberSeed(email, (await page.getByTestId("mfa-secret").innerText()).replace(/\s/g, ""));
    await page.getByTestId("mfa-code").fill(await freshCode(email));
    await page.getByTestId("mfa-submit").click();
    await page.getByTestId("codes-saved").check();
    await page.getByTestId("codes-continue").click();
    await expect(page).toHaveURL(/\/checkout/);
    await page.goto("/cart");
    await expect(page.getByTestId("cart-item")).toHaveCount(1);
  });
  test("the cart icon opens the cart for visitors, with a friendly empty state", async ({ page }) => {
    await logout(page);
    await page.goto("/");
    await page.getByRole("link", { name: /^Cart,/ }).click();
    await expect(page).toHaveURL(/\/cart$/);
    await expect(page.getByText("Your cart is empty. Explore our courses and start learning today!")).toBeVisible();
  });
});

test.describe("review moderation screens", () => {
  test.skip(!PASSWORD, "Set E2E_PASSWORD (the seed password) to run signed-in flows");
  test("super admin sees the moderation page with reported, all and hidden reviews", async ({ page }) => {
    await login(page, USERS.admin, PASSWORD, "/admin/course-reviews");
    await expect(page.getByRole("heading", { name: "Course reviews", exact: true })).toBeVisible();
    await page.getByRole("tab", { name: /^All/ }).click();
    await expect(page.getByTestId("moderation-row").first()).toBeVisible();
  });
  test("payments page shows the Stripe mode and never shows a secret", async ({ page }) => {
    await login(page, USERS.admin, PASSWORD, "/admin/payments");
    await expect(page.getByTestId("stripe-mode")).toBeVisible();
    await expect(page.locator("body")).not.toContainText(/sk_(test|live)_[A-Za-z0-9]{12,}/);
  });
});

test.describe("final review (owner 2026-11-25)", () => {
  test("light is the default theme; a dark choice from the toggle is remembered", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("html")).toHaveClass(/\blight\b/);
    await expect(page.locator("html")).not.toHaveClass(/\bdark\b/);
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe("rgb(244, 245, 250)");
    await page.getByRole("button", { name: "Switch light or dark theme" }).first().click();
    await expect(page.locator("html")).toHaveClass(/\bdark\b/);
    await page.reload();
    await expect(page.locator("html")).toHaveClass(/\bdark\b/);
    await page.getByRole("button", { name: "Switch light or dark theme" }).first().click();
    await expect(page.locator("html")).toHaveClass(/\blight\b/);
  });

  test("while card payments are off, no Buy or Checkout button leads to an error", async ({ page }) => {
    await page.route("**/api/payments/mode", (r) => r.fulfill({ json: { mode: "off", provider: null } }));
    await page.goto(`/courses/${PAID_COURSE}`);
    const card = page.locator("[data-testid=purchase-card]:visible").first();
    await expect(card.getByTestId("payments-closed")).toBeVisible();
    await expect(card.getByTestId("buy-now")).toHaveCount(0);
    await card.getByRole("link", { name: "Contact us to enrol" }).click();
    await expect(page).toHaveURL(/\/contact\?topic=payment/);
    await expect(page.locator("#c-topic")).toHaveValue("payment");
  });

  test("terms and privacy pages exist and are linked from the footer and sign-up", async ({ page }) => {
    await page.goto("/register");
    await expect(page.locator("main").getByRole("link", { name: "Terms of use" })).toHaveAttribute("href", "/policies/terms");
    await page.locator("footer").getByRole("link", { name: "Privacy", exact: true }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Privacy policy");
    await expect(page.getByTestId("policy-text")).toContainText("never see or store your card number");
    await page.goto("/policies/terms");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Terms of use");
    await expect(page.getByTestId("policy-text")).toContainText("12 months");
    await expect(page.getByTestId("policy-text")).not.toContainText(/lifetime access|for life/i);
  });

  test("super admin sees Sign-in methods with the redirect URI for each provider", async ({ page }) => {
    test.skip(!PASSWORD, "Set E2E_PASSWORD (the seed password) to run admin flows");
    await login(page, USERS.admin, PASSWORD, "/admin/sign-in");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Sign-in methods");
    for (const k of ["google", "github", "facebook", "linkedin"]) await expect(page.getByTestId(`provider-${k}`)).toBeVisible();
    await page.getByTestId("setup-google").click();
    await expect(page.getByTestId("provider-google")).toContainText("/api/auth/oauth/google/callback");
    await expect(page.getByTestId("save-google")).toBeDisabled();
  });
});

test.describe.serial("manual enrollment and the invitation link (owner 2026-11-25)", () => {
  test.skip(!PASSWORD, "Set E2E_PASSWORD (the seed password) to run instructor/admin flows");
  const student = `e2e-invite-${Date.now()}@example.com`;
  let course = "";
  let invitePath = "";

  test("an instructor sends a manual enrollment request for one of their courses", async ({ page }) => {
    await login(page, USERS.instructor, PASSWORD, "/studio/enrollments");
    await expect(page.getByRole("heading", { name: "Manual enrollments", exact: true })).toBeVisible();
    await page.getByTestId("new-enrollment").click();
    await page.getByTestId("me-email").fill(student);
    await expect(page.getByTestId("me-new")).toBeVisible(); // no account yet: the student will get an invitation
    await page.getByTestId("me-name").fill("E2E Invitee");
    const option = page.getByTestId("me-course").first();
    await option.waitFor({ timeout: 10_000 }).catch(() => undefined);
    test.skip(!(await option.count()), "the instructor has no published course");
    course = (await option.locator("span.font-bold").first().innerText()).trim();
    await option.click();
    await expect(option).toHaveAttribute("aria-selected", "true");
    await page.getByTestId("me-submit").click();
    await expect(page.getByText(/Request ME-\d+ sent to DevOps Easy Learning/)).toBeVisible();
    // back on the list: the request waits for DEL
    const row = page.getByTestId("enrollment-request").filter({ hasText: student });
    await expect(row).toBeVisible();
    await expect(row.getByText("Pending").first()).toBeVisible();
  });

  test("the super admin finds it with the filters, approves it as complimentary and copies the invitation link", async ({ page }) => {
    test.skip(!course, "needs the request from the previous test");
    await logout(page);
    await login(page, USERS.admin, PASSWORD, "/admin/enrollments");
    await page.getByLabel("Search requests").fill(student);
    await expect(page).toHaveURL(/[?&]q=/);
    const row = page.getByTestId("enrollment-request").filter({ hasText: student });
    await expect(row).toBeVisible();
    // Course filter: applied by the API and kept in the URL.
    const filter = page.getByLabel("Course", { exact: true });
    await filter.selectOption({ label: course });
    await expect(page).toHaveURL(/[?&]course=[0-9a-f-]{36}/);
    await expect(row).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("Course", { exact: true })).toHaveValue(/[0-9a-f-]{36}/);
    await expect(row).toBeVisible();

    await row.locator("button[aria-expanded]").first().click();
    const box = row.getByTestId("approve-box");
    await box.getByRole("radio", { name: "Complimentary" }).click();
    await expect(box.getByTestId("approve-request")).toBeDisabled(); // a reason is required
    await box.getByLabel("Why it is complimentary").fill("Playwright smoke test scholarship");
    await box.getByTestId("approve-request").click();
    await expect(page.getByText("Approved. The invitation is on its way.")).toBeVisible();

    await page.getByRole("tab", { name: "Approved" }).click();
    await expect(page).toHaveURL(/[?&]status=approved/);
    await expect(row).toBeVisible();
    const toggle = row.locator("button[aria-expanded]").first();
    if ((await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click();
    await row.getByTestId("copy-invite").click();
    const link = (await row.getByTestId("invite-link").innerText()).trim();
    invitePath = new URL(link).pathname;
    expect(invitePath).toMatch(/^\/invite\/[\w-]+$/);
  });

  test("opening the invitation shows the email-code step; a revoked or unknown link shows a clear message", async ({ page, browser }) => {
    test.skip(!invitePath, "needs the invitation link from the previous test");
    const guest = await browser.newContext();
    const visitor = await guest.newPage();
    await visitor.goto(invitePath);
    await expect(visitor.getByRole("heading", { name: /^Welcome, E2E/ })).toBeVisible();
    await expect(visitor.getByTestId("invite-courses")).toContainText(course);
    await expect(visitor.getByRole("heading", { name: "Create your account" })).toBeVisible();
    await visitor.getByTestId("invite-send-code").click();
    const form = visitor.getByTestId("invite-form");
    await expect(form.getByLabel("Code from the email")).toBeVisible();
    await expect(form.getByTestId("invite-accept")).toBeDisabled(); // nothing happens before the six-digit code

    // DEL revokes it: the same link now explains it can't be used.
    await login(page, USERS.admin, PASSWORD, `/admin/enrollments?status=approved&q=${encodeURIComponent(student)}`);
    const row = page.getByTestId("enrollment-request").filter({ hasText: student });
    await row.locator("button[aria-expanded]").first().click();
    await row.getByRole("button", { name: "Revoke invitation" }).click();
    await expect(page.getByText("Invitation revoked.")).toBeVisible();
    await visitor.reload();
    await expect(visitor.getByRole("alert").filter({ hasText: "This invitation can’t be used" })).toBeVisible();
    await expect(visitor.getByRole("alert").filter({ hasText: "This invitation" })).toContainText(/replaced by a newer one or cancelled/);

    await visitor.goto("/invite/not-a-real-invitation-token");
    await expect(visitor.getByRole("alert").filter({ hasText: "This invitation can’t be used" })).toBeVisible();
    await expect(visitor.getByRole("alert").filter({ hasText: "This invitation" })).toContainText(/not valid/);
    await expect(visitor.getByRole("alert").filter({ hasText: "This invitation" }).getByRole("link", { name: "Contact DEL" })).toHaveAttribute("href", "/contact");
    await guest.close();
  });
});

test.describe("admin screens: refunds, users and roles, review filters", () => {
  test.skip(!PASSWORD, "Set E2E_PASSWORD (the seed password) to run admin flows");

  test("Admin › Refunds loads and every status tab works", async ({ page }) => {
    await login(page, USERS.admin, PASSWORD, "/admin/refunds");
    await expect(page.getByRole("heading", { name: "Refunds", exact: true })).toBeVisible();
    const tabs = page.getByRole("group", { name: "Filter requests" }).getByRole("button");
    await expect(tabs.first()).toHaveAttribute("aria-pressed", "true");
    for (const name of ["All", "Refunded automatically", "Approved", "Declined by policy", "Declined after review", "Needs action"]) {
      const tab = tabs.filter({ hasText: new RegExp(`^${name}`) });
      await tab.click();
      await expect(tab).toHaveAttribute("aria-pressed", "true");
      // a list or the empty state, never an error
      await expect(page.getByTestId("refund-list").or(page.getByText(/^(Nothing waiting|No requests here)$/))).toBeVisible();
    }
  });

  test("Admin › Users and roles: search, open a user and see the account history", async ({ page }) => {
    await login(page, USERS.admin, PASSWORD, "/admin/users");
    await expect(page.getByRole("heading", { name: "Users and roles", exact: true })).toBeVisible();
    await page.getByLabel("Search users").fill("nadia");
    const row = page.getByTestId("user-row").filter({ hasText: USERS.instructor });
    await expect(row).toBeVisible();
    await expect(page.getByTestId("user-row").filter({ hasText: USERS.student })).toHaveCount(0);
    await row.getByTestId("manage-user").click();
    const dialog = page.getByTestId("manage-dialog");
    await expect(dialog).toContainText(USERS.instructor);
    await expect(dialog.getByRole("heading", { name: "History" })).toBeVisible();
    await expect(dialog.getByTestId("user-history").or(dialog.getByText("No changes recorded yet."))).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });

  test("Admin › Course reviews: the course filter is applied and kept in the URL", async ({ page }) => {
    await login(page, USERS.admin, PASSWORD, "/admin/course-reviews?view=all");
    await expect(page.getByRole("tab", { name: /^All/ })).toHaveAttribute("aria-selected", "true");
    const filter = page.getByLabel("Course", { exact: true });
    await expect(filter.locator("option").first()).toHaveText("All courses");
    test.skip((await filter.locator("option").count()) < 2, "no course has reviews yet");
    const title = (await filter.locator("option").nth(1).innerText()).trim();
    await filter.selectOption({ index: 1 });
    await expect(page).toHaveURL(/[?&]course=[0-9a-f-]{36}/);
    const rows = page.getByTestId("moderation-row");
    await expect(rows.first()).toBeVisible();
    await expect.poll(async () => (await rows.allInnerTexts()).every((t) => t.includes(title))).toBe(true);
    await page.getByRole("button", { name: "Clear filters" }).click();
    await expect(page).not.toHaveURL(/[?&]course=/);
  });
});

test.describe.serial("curriculum drag and drop", () => {
  test.skip(!PASSWORD, "Set E2E_PASSWORD (the seed password) to run instructor flows");

  test("an instructor reorders lessons with the keyboard and the order is saved", async ({ page }) => {
    const apiBase = watchApiBase(page);
    await login(page, USERS.instructor, PASSWORD, "/studio/courses");
    await page.getByTestId("new-course").click();
    await page.getByLabel("Working title").fill(`E2E arrange ${Date.now()}`);
    await page.getByTestId("create-course").click();
    await page.waitForURL(/\/studio\/courses\/[0-9a-f-]{36}/);
    const courseId = page.url().match(/\/studio\/courses\/([0-9a-f-]{36})/)![1];
    try {
      await page.goto(`/studio/courses/${courseId}?step=curriculum`);
      await page.getByLabel("New section title").fill("Arrange");
      await page.getByTestId("add-section").click();
      await expect(page.getByLabel("Section 1 title")).toHaveValue("Arrange");
      for (const t of ["Alpha lesson", "Beta lesson"]) {
        await page.getByLabel("New lesson title").fill(t);
        await page.getByLabel("Lesson type").selectOption("article");
        await page.getByTestId("add-lecture").click();
        await expect(page.getByTestId("lesson-row").filter({ hasText: t })).toBeVisible();
      }
      const rows = page.getByTestId("lesson-row");
      await expect(rows.nth(0)).toContainText("Alpha lesson");

      // dnd-kit keyboard sensor: Space picks up, arrow moves, Space drops.
      const saved = page.waitForResponse((r) => r.url().endsWith(`/instructor/courses/${courseId}/curriculum`) && r.request().method() === "PUT");
      await page.getByRole("button", { name: "Drag lesson Alpha lesson" }).focus();
      await page.keyboard.press("Space");
      await page.waitForTimeout(250);
      await page.keyboard.press("ArrowDown");
      await page.waitForTimeout(250);
      await page.keyboard.press("Space");
      expect((await saved).status()).toBe(200);
      await expect(rows.nth(0)).toContainText("Beta lesson");

      await page.reload();
      await expect(rows.nth(0)).toContainText("Beta lesson");
      await expect(rows.nth(1)).toContainText("Alpha lesson");
    } finally {
      // never published; remove the draft so test runs leave nothing behind
      if (apiBase()) expect(await apiFromPage(page, apiBase(), "DELETE", `/instructor/courses/${courseId}`)).toBe(200);
    }
  });
});

test.describe("lesson player", () => {
  test.skip(!PASSWORD, "Set E2E_PASSWORD (the seed password) to run signed-in flows");

  test("double-click toggles full screen; Next changes the URL without reloading the page or the stage", async ({ page }) => {
    await login(page, USERS.student, PASSWORD, "/student/courses");
    const href = await page.locator('a[href^="/learn/"]').first().getAttribute("href");
    test.skip(!href, "the demo student has no course");
    await page.goto(href!);
    const player = page.getByTestId("video-player");
    await expect(player).toBeVisible();

    const box = (await player.boundingBox())!;
    await page.mouse.dblclick(box.x + box.width / 2, box.y + box.height / 3);
    await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBe(true);
    await expect.poll(() => page.evaluate(() => !!document.fullscreenElement?.classList.contains("player-stage"))).toBe(true);
    const fsBox = (await player.boundingBox())!;
    await page.mouse.dblclick(fsBox.x + fsBox.width / 2, fsBox.y + fsBox.height / 3);
    await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBe(false);

    const next = page.getByTestId("player-next");
    test.skip(!(await next.count()) || (await next.isDisabled()), "the course has a single lesson");
    // Marks that a page load or a remount of the stage would wipe out.
    await page.evaluate(() => {
      (window as unknown as { __e2eStay?: boolean }).__e2eStay = true;
      (document.querySelector(".player-stage") as HTMLElement & { __e2eStay?: boolean }).__e2eStay = true;
    });
    const before = page.url();
    await player.hover(); // wake the control bar
    await next.click();
    await expect.poll(() => page.url()).not.toBe(before);
    expect(new URL(page.url()).pathname).toMatch(/^\/learn\/[\w-]+\/[\w-]+$/);
    expect(await page.evaluate(() => (window as unknown as { __e2eStay?: boolean }).__e2eStay === true)).toBe(true);
    expect(await page.evaluate(() => (document.querySelector(".player-stage") as HTMLElement & { __e2eStay?: boolean }).__e2eStay === true)).toBe(true);
  });
});

test.describe("quick search: ⌘K / Ctrl+K on every page (owner 2026-11-26)", () => {
  /** A word from a real course title, so this works on any catalogue (local demo or staging). */
  async function courseWord(page: Page) {
    await page.goto("/courses");
    const title = (await page.getByTestId("course-row").first().innerText()).split("\n").find((l) => l.trim().length > 12) ?? "";
    return title.split(/\s+/).find((w) => /^[A-Za-z]{5,}$/.test(w)) ?? "DevOps";
  }

  test("keyboard: open, find a course, Enter opens it; Esc and / work; signed out sees no studio pages", async ({ page }) => {
    const word = await courseWord(page);
    await page.goto("/");
    const dialog = page.getByRole("dialog", { name: "Quick search" });
    // Retried until the page has hydrated and listens for the shortcut.
    await expect(async () => { await page.keyboard.press("ControlOrMeta+k"); await expect(dialog).toBeVisible({ timeout: 1000 }); }).toPass();
    const input = dialog.getByRole("combobox");
    await expect(input).toBeFocused();
    await expect(dialog.getByTestId("qs-group-pages")).toHaveCount(0);
    await input.fill(word);
    const first = dialog.getByTestId("qs-course").first();
    await expect(first).toBeVisible();
    await expect(first).toHaveAttribute("aria-selected", "true");
    await expect(input).toHaveAttribute("aria-activedescendant", (await first.getAttribute("id"))!);
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/courses\/[\w-]+$/);
    await expect(dialog).toHaveCount(0);
    // "/" opens it when not typing; Esc closes it and the page stays.
    await page.keyboard.press("/");
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(page).toHaveURL(/\/courses\/[\w-]+$/);
  });

  test("the header search field opens it; Help results; full screen on a phone", async ({ page }) => {
    await page.goto("/courses");
    await page.getByTestId("search-open").click();
    const dialog = page.getByRole("dialog", { name: "Quick search" });
    await dialog.getByRole("combobox").fill("refund");
    await expect(dialog.getByTestId("qs-group-help")).toContainText("Access and refunds policy");
    await page.keyboard.press("Escape");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByTestId("search-open-icon").click();
    await expect(dialog).toBeVisible();
    // measured after the opening animation (pop-in scales from 98%)
    await expect.poll(async () => Math.round((await dialog.boundingBox())!.width)).toBe(390);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  });

  test("studio pages are role-aware: a student never sees admin pages, an admin does", async ({ page }) => {
    test.skip(!PASSWORD, "Set E2E_PASSWORD (the seed password) to run signed-in flows");
    await login(page, USERS.student, PASSWORD, "/student");
    await visible(page, "search-open").click();
    const dialog = page.getByRole("dialog", { name: "Quick search" });
    const input = dialog.getByRole("combobox");
    await expect(dialog.getByTestId("qs-group-mine")).toBeVisible();
    await input.fill("purchase");
    await expect(dialog.getByTestId("qs-page").filter({ hasText: "Purchase history" })).toBeVisible();
    await input.fill("audit log");
    await expect(dialog.getByTestId("qs-page")).toHaveCount(0);
    await input.fill("payouts");
    await expect(dialog.getByTestId("qs-page")).toHaveCount(0);
    await page.keyboard.press("Escape");
    await logout(page);

    await login(page, USERS.admin, PASSWORD, "/admin");
    await expect(async () => { await page.keyboard.press("ControlOrMeta+k"); await expect(dialog).toBeVisible({ timeout: 1000 }); }).toPass();
    await dialog.getByRole("combobox").fill("audit log");
    const audit = dialog.getByTestId("qs-page").filter({ hasText: "Audit log" });
    await expect(audit).toBeVisible();
    await audit.click();
    await expect(page).toHaveURL(/\/admin\/audit$/);
  });
});
