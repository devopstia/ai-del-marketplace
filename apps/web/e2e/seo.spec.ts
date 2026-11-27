import { expect, test } from "@playwright/test";

// Search engines and link previews (docs/SEO.md). Test stacks are not production, so they must never be indexed.
const COURSE = process.env.E2E_COURSE_SLUG || "ai-for-devops";

const ldOf = async (page: import("@playwright/test").Page) =>
  (await page.locator('script[type="application/ld+json"]').allTextContents()).map((t) => JSON.parse(t) as Record<string, unknown>);

test.describe("search engines", () => {
  test("a non-production stack tells search engines to stay away", async ({ request, page }) => {
    const robots = await (await request.get("/robots.txt")).text();
    expect(robots).toMatch(/Disallow: \/\s*$/m);
    expect(robots).not.toMatch(/Sitemap:/);
    expect((await request.get("/sitemap.xml")).ok()).toBe(true);
    await page.goto("/");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  });

  test("course page: canonical address, link preview and Course data", async ({ page }) => {
    await page.goto(`/courses/${COURSE}`);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", new RegExp(`/courses/${COURSE}$`));
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", /^https?:\/\/.+/);
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute("content", "summary_large_image");
    const ld = await ldOf(page);
    const course = ld.find((d) => d["@type"] === "Course");
    expect(course).toMatchObject({ name: expect.any(String), provider: { name: "DevOps Easy Learning" } });
    expect((course!.offers as { price: string; priceCurrency: string }[])[0]).toMatchObject({ price: expect.stringMatching(/^\d+\.\d\d$/), priceCurrency: expect.stringMatching(/^[A-Z]{3}$/) });
    expect((course!.hasCourseInstance as { courseMode: string; courseWorkload: string }[])[0]).toMatchObject({ courseMode: "Online", courseWorkload: expect.stringMatching(/^PT/) });
    expect(ld.map((d) => d["@type"])).toEqual(expect.arrayContaining(["BreadcrumbList", "FAQPage"]));
    // Every lesson title is in the page, also in closed sections (search engines read the whole outline).
    const titles = await page.locator('[id^="sec-"] li').count();
    expect(titles).toBeGreaterThan(0);
  });

  test("course page: its own sharing banner, full preview tags and share buttons (docs/SOCIAL_SHARING.md)", async ({ page, request }) => {
    await page.goto(`/courses/${COURSE}`);
    const img = await page.locator('meta[property="og:image"]').getAttribute("content");
    expect(img).toMatch(/\/media\/images\/social\/[0-9a-f-]{36}-[0-9a-f]{12}\.(jpg|png)$/);
    await expect(page.locator('meta[property="og:image:width"]')).toHaveAttribute("content", "1200");
    await expect(page.locator('meta[property="og:image:height"]')).toHaveAttribute("content", "630");
    await expect(page.locator('meta[property="og:image:type"]')).toHaveAttribute("content", /^image\/(jpeg|png)$/);
    await expect(page.locator('meta[property="og:image:alt"]')).toHaveAttribute("content", /DevOps Easy Learning/);
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute("content", new RegExp(`/courses/${COURSE}$`));
    await expect(page.locator('meta[name="twitter:image"]')).toHaveAttribute("content", img!);
    const desc = await page.locator('meta[property="og:description"]').getAttribute("content");
    expect(desc!.length).toBeLessThanOrEqual(160);
    const res = await request.get(new URL(img!).pathname);
    expect(res.status()).toBe(200);
    expect(res.headers()["cache-control"]).toContain("immutable");
    expect((await res.body()).length).toBeLessThanOrEqual(300 * 1024);
    const share = page.getByTestId("share-buttons");
    await expect(share.getByRole("link", { name: "Share on WhatsApp" })).toHaveAttribute("href", new RegExp(`^https://wa\\.me/\\?text=.*${COURSE}`));
    for (const n of ["Facebook", "LinkedIn", "Telegram", "X", "Email"]) await expect(share.getByRole("link", { name: `Share on ${n}` })).toBeVisible();
    await expect(share.getByRole("button", { name: "Copy link" })).toBeVisible();
  });

  test("site banner: homepage and fixed address", async ({ page, request }) => {
    await page.goto("/");
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", /\/media\/images\/social\/site-[0-9a-f]{12}\.jpg$/);
    const r = await request.get("/og/site.jpg");
    expect(r.status()).toBe(200);
    expect(r.headers()["content-type"]).toBe("image/jpeg");
  });

  test("topic pages: own address, heading and breadcrumbs; filtered catalogue points to them", async ({ page }) => {
    await page.goto("/courses");
    const topic = page.getByRole("navigation", { name: "Breadcrumb" });
    await expect(topic).toHaveCount(0);
    const slug = await page.locator('input[name="category"]').first().getAttribute("value");
    await page.goto(`/courses?category=${slug}`);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", new RegExp(`/courses/topic/${slug}$`));
    await page.goto(`/courses/topic/${slug}`);
    await expect(page.getByRole("navigation", { name: "Breadcrumb" }).getByRole("link", { name: "Courses" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("courses");
    expect((await ldOf(page)).some((d) => d["@type"] === "BreadcrumbList")).toBe(true);
    expect((await page.goto("/courses/topic/no-such-topic"))?.status()).toBe(404);
  });

  test("homepage: organisation and site search data", async ({ page }) => {
    await page.goto("/");
    const ld = await ldOf(page);
    expect(ld.find((d) => d["@type"] === "Organization")).toMatchObject({ name: "DevOps Easy Learning", sameAs: expect.arrayContaining(["https://www.devopseasylearning.com/"]) });
    expect(ld.find((d) => d["@type"] === "WebSite")).toMatchObject({ potentialAction: { "@type": "SearchAction" } });
    await expect(page.locator('meta[name="description"]')).not.toHaveAttribute("content", /labs/i);
  });
});
