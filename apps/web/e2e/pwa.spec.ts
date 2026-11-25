import { devices, expect, test } from "@playwright/test";

// The installable app (PWA): AGENTS.md rule 18 and docs/PWA.md.
test.describe("installable app", () => {
  test("manifest, icons and service worker are served", async ({ request }) => {
    const m = await (await request.get("/manifest.webmanifest")).json();
    expect(m).toMatchObject({ name: "DevOps Easy Learning", short_name: "DEL", display: "standalone", start_url: "/my-learning?source=pwa" });
    expect(m.icons.map((i: { sizes: string; purpose: string }) => `${i.sizes}:${i.purpose}`)).toEqual(expect.arrayContaining(["192x192:any", "512x512:any", "512x512:maskable"]));
    for (const i of m.icons) expect((await request.get(i.src)).headers()["content-type"]).toBe("image/png");
    expect((await request.get("/sw.js")).ok()).toBe(true);
    expect((await request.get("/offline.html")).ok()).toBe(true);
  });

  test("Chrome finds the site installable", async ({ page, context }) => {
    await page.goto("/");
    await page.evaluate(() => navigator.serviceWorker.ready);
    const cdp = await context.newCDPSession(page);
    expect((await cdp.send("Page.getInstallabilityErrors")).installabilityErrors).toEqual([]);
  });

  test("offline: a page that can't load shows the offline screen", async ({ page, context }) => {
    await page.goto("/");
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload();
    await context.setOffline(true);
    await page.goto("/courses").catch(() => {});
    await expect(page.getByRole("heading", { name: "You're offline" })).toBeVisible();
    await context.setOffline(false);
  });

  test("the install page shows the steps for an iPhone", async ({ browser }) => {
    const ctx = await browser.newContext({ ...devices["iPhone 14"] });
    const page = await ctx.newPage();
    await page.goto("/install");
    await expect(page.locator("#this-device")).toHaveText("On this iPhone or iPad");
    await expect(page.getByTestId("install-steps")).toContainText("Add to Home Screen");
    await expect(page.getByTestId("install-qr")).toHaveCount(0);
    await ctx.close();
  });

  test("on a computer the install page offers a QR code for the phone", async ({ page }) => {
    await page.goto("/install");
    await expect(page.getByTestId("install-qr").locator("svg")).toBeVisible();
  });
});
