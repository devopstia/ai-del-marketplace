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
