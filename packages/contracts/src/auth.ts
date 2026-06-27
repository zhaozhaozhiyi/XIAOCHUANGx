import { z } from "zod";

export const AUTH_COOKIE_NAME = "jlc_session";

export const authProfileSchema = z.object({
  phone: z.string(),
  maskedPhone: z.string(),
  nickname: z.string(),
  tenantName: z.string(),
  loggedInAt: z.string().datetime(),
});

export type AuthProfile = z.infer<typeof authProfileSchema>;

export const sendCodeRequestSchema = z.object({
  phone: z.string().regex(/^1[3-9]\d{9}$/, "请输入正确的 11 位手机号"),
});

export const sendCodeResponseSchema = z.object({
  ok: z.literal(true),
  resendAfterSeconds: z.number().int().positive(),
});

export const loginRequestSchema = z.object({
  phone: z.string().regex(/^1[3-9]\d{9}$/),
  code: z.string().regex(/^\d{6}$/),
  agreed: z.literal(true, {
    errorMap: () => ({ message: "请先阅读并同意用户协议与隐私政策" }),
  }),
});

export const loginResponseSchema = z.object({
  ok: z.literal(true),
  sessionToken: z.string(),
  profile: authProfileSchema,
});

export const meResponseSchema = z.object({
  profile: authProfileSchema,
});
