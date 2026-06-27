import { expect, test } from "@playwright/test";
import { openUserMenu, seedAuthenticatedSession } from "./helpers";

test.describe("MVP auth", () => {
  test("redirects unauthenticated users to login", async ({ page }) => {
    await page.goto("/chat");
    await page.waitForURL(/\/login\?redirect=/);
    await expect(page.getByRole("heading", { name: "小窗" })).toBeVisible();
  });

  test("logs out through the user menu from an authenticated session", async ({
    page,
  }) => {
    await seedAuthenticatedSession(page);
    await page.goto("/chat");
    await expect(page.getByText("今天要处理什么？")).toBeVisible();

    await openUserMenu(page);
    await page.getByRole("menuitem", { name: "退出登录" }).click();

    await page.waitForURL("**/login");
    await expect(page.getByRole("button", { name: "登录" })).toBeVisible();
  });
});
