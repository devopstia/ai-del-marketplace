import { test } from "@playwright/test";
import { expect, login, logout, PASSWORD, tinyVideo, USERS, visible } from "./helpers";

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

  test("every popular search on the home page finds a course", async ({ page }) => {
    await page.goto("/");
    const chips = await page.locator('a[href^="/courses?q="]').evaluateAll((as) => as.map((a) => a.getAttribute("href")!));
    expect(chips.length).toBeGreaterThan(0);
    for (const href of chips) {
      await page.goto(href);
      await expect(page.getByTestId("course-row").first(), href).toBeVisible();
    }
  });

  test("search filters the catalogue", async ({ page }) => {
    await page.goto("/courses?q=MCP");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("MCP");
    await expect(page.getByTestId("course-row").first()).toBeVisible();
  });

  test("protected pages send signed-out visitors to log in", async ({ page }) => {
    await page.goto("/my-learning");
    await expect(page).toHaveURL(/\/login\?next=%2Fmy-learning/);
  });
});

test.describe.serial("learner buys and studies a course", () => {
  const email = `e2e-${Date.now()}@example.com`;
  const password = "e2e-password-123";

  test("register", async ({ page }) => {
    await page.goto("/register");
    await page.getByLabel("Full name").fill("E2E Learner");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByTestId("auth-submit").click();
    await expect(page).toHaveURL(/\/my-learning/);
    await expect(page.getByRole("heading", { name: "My learning" })).toBeVisible();
  });

  test("buy with the local test payment and land in My learning", async ({ page }) => {
    await login(page, email, password, `/courses/${PAID_COURSE}`);
    await expect(page).toHaveURL(new RegExp(`/courses/${PAID_COURSE}`));
    await visible(page, "buy-now").click();
    await expect(page).toHaveURL(/\/checkout$/);
    await page.getByTestId("consent").check();
    await page.getByTestId("pay").click();
    // Without Stripe keys the API returns the dev test-payment page
    await expect(page).toHaveURL(/\/checkout\/test|checkout\.stripe\.com/);
    test.skip(page.url().includes("stripe.com"), "Stripe test mode is configured; card entry is out of scope for the smoke test");
    await page.getByTestId("complete-test-payment").click();
    await expect(page.getByTestId("checkout-success")).toHaveText("You’re enrolled");
    await page.goto("/my-learning");
    await expect(page.getByTestId("learning-item").first()).toBeVisible();
  });

  test("play a lecture with a signed URL", async ({ page }) => {
    await login(page, email, password, `/learn/${PAID_COURSE}`);
    await expect(page).toHaveURL(new RegExp(`/learn/${PAID_COURSE}/[\\w-]+`));
    await expect(page.getByTestId("video-player")).toBeVisible();
    await expect.poll(() => page.locator("video").getAttribute("src")).toContain("http");
    await expect(page.getByRole("navigation", { name: "Course content" }).first()).toBeAttached();
  });
  test("refund from the receipt (within 14 days, little watched)", async ({ page }) => {
    await login(page, email, password, "/orders");
    // sign-in finishes with a full page load of /orders: wait for it before moving on
    await page.waitForURL(/\/orders$/);
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
    await page.getByLabel("New lecture title").fill("Welcome");
    await page.getByTestId("add-lecture").click();
    await page.getByRole("button", { name: /^Welcome/ }).click();
    await page.getByLabel("Upload video").setInputFiles(video!);
    await expect(page.getByText(/Video uploaded/)).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText("Ready", { exact: true }).first()).toBeVisible({ timeout: 60_000 });

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
    await page.getByTestId("open-del-studio").first().click();
    await expect(page.getByTestId("acting-banner")).toContainText("DevOps Easy Learning");
    await page.goto("/studio/sales");
    await expect(page.getByTestId("terms-note")).toContainText("DEL");
    await page.getByTestId("back-to-admin").first().click();
    await expect(page).toHaveURL(/\/admin$/);
  });

  test("admin role changes ask for confirmation", async ({ page }) => {
    await logout(page);
    await login(page, USERS.admin, PASSWORD, "/admin/users");
    await page.getByLabel("Search users").fill("nadia");
    const roles = page.getByRole("group", { name: /Roles of Nadia/ });
    const adminChip = roles.getByRole("button", { name: "admin", exact: true });
    await expect(adminChip).toHaveAttribute("aria-pressed", "false");
    await adminChip.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("Give the admin role");
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(adminChip).toHaveAttribute("aria-pressed", "false");
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
    await login(page, USERS.student, PASSWORD, "/my-learning");
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
    await page.getByTestId("help-row").filter({ hasText: title }).click();
    await expect(page).toHaveURL(new RegExp(`/help/${slug}$`));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
    await expect(page.getByTestId("video-player")).toBeVisible();
    await expect(page.getByRole("link", { name: "Contact support" })).toHaveAttribute("href", /\/support\/new\?category=other/);
  });

  test("the admin removes it", async ({ page }) => {
    await login(page, USERS.admin, PASSWORD, "/admin/help");
    page.once("dialog", (d) => void d.accept());
    await page.getByRole("button", { name: `Delete ${title}` }).click();
    await expect(page.getByText(title)).toHaveCount(0);
  });
});

