import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

export const AUTH_PHONE = "13800138000";

export async function login(page: Page, phone = AUTH_PHONE) {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "小窗" })).toBeVisible();
  await page.getByLabel("手机号").fill(phone);
  await page.getByLabel("验证码").fill("123456");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "登录" }).click();
  await page.waitForURL("**/chat");
}

export async function seedAuthenticatedSession(page: Page, phone = AUTH_PHONE) {
  await page.context().addCookies([
    {
      name: "jlc_session",
      value: phone,
      domain: "127.0.0.1",
      path: "/",
      httpOnly: false,
      sameSite: "Lax",
    },
  ]);

  await page.addInitScript(([seedPhone]) => {
    window.localStorage.setItem(
      "jlc_auth_profile",
      JSON.stringify({
        phone: seedPhone,
        maskedPhone: "138****8000",
        nickname: "研究员",
        tenantName: "小窗 · 企业租户",
        loggedInAt: new Date().toISOString(),
      }),
    );
  }, [phone]);
}

export async function openUserMenu(page: Page) {
  await page.getByRole("button", { name: /研究员|设置与账号/ }).click();
  await expect(page.getByRole("menu")).toBeVisible();
}
