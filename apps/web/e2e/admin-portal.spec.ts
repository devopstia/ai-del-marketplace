import { test } from "@playwright/test";
import { expect, login, PASSWORD, USERS } from "./helpers";

/** Super Admin portal screens (owner 2026-11-26, docs/SUPER_ADMIN.md). Read-only checks: nothing is changed here. */
test.describe("super admin portal", () => {
  test.skip(!PASSWORD, "Set E2E_PASSWORD (the seed password) to run admin flows");

  test("Role management: Super Admin is locked; changing a capability asks for the authenticator code", async ({ page }) => {
    await login(page, USERS.admin, PASSWORD, "/admin/roles");
    await expect(page.getByRole("heading", { name: "Role management", exact: true })).toBeVisible();
    await expect(page.getByTestId("role-card-super_admin")).toContainText("System role");
    await expect(page.getByTestId("role-card-super_admin").getByRole("checkbox")).toHaveCount(0);
    const cap = page.getByTestId("cap-student.ai.ask");
    await cap.uncheck();
    await expect(page.getByTestId("save-roles-bar")).toBeVisible();
    await expect(page.getByTestId("roles-code")).toBeVisible();
    await cap.check();
    await expect(page.getByTestId("save-roles-bar")).toHaveCount(0);
  });

  test("Users: an account shows sign-in facts and the help tools", async ({ page }) => {
    await login(page, USERS.admin, PASSWORD, "/admin/users");
    await page.getByLabel("Search users").fill("student@");
    await page.getByTestId("user-row").filter({ hasText: USERS.student }).getByTestId("manage-user").click();
    const dialog = page.getByTestId("manage-dialog");
    await expect(dialog.getByTestId("user-facts")).toContainText("Last sign-in");
    const tools = dialog.getByTestId("account-tools");
    await expect(tools.getByTestId("send-reset")).toBeEnabled();
    await expect(tools.getByTestId("suspend")).toBeDisabled(); // needs a reason
    await expect(tools.getByTestId("delete-user")).toBeDisabled(); // needs the email typed back
    await page.keyboard.press("Escape");
  });

  test("Courses: a course page has preview, edit and archive; the archive has its three lists", async ({ page }) => {
    await login(page, USERS.admin, PASSWORD, "/admin/courses");
    await page.getByTestId("admin-course-row").first().getByTestId("open-course").click();
    await expect(page.getByRole("heading", { name: "Preview the content" })).toBeVisible();
    await expect(page.getByTestId("course-edit")).toBeVisible();
    await expect(page.getByTestId("delete-course")).toBeDisabled();
    await page.goto("/admin/courses/archived");
    for (const t of ["archived", "deleting", "purged"]) await expect(page.getByTestId(`archive-tab-${t}`)).toBeVisible();
  });

  test("System health lists the services and job queues", async ({ page }) => {
    await login(page, USERS.admin, PASSWORD, "/admin/system");
    const h = page.getByTestId("system-health");
    await expect(h).toContainText("Database");
    await expect(h).toContainText("Background jobs");
  });
});
