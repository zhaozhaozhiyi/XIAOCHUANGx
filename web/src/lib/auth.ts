export const AUTH_COOKIE = "jlc_session";
export const AUTH_STORAGE_KEY = "jlc_auth_profile";

/** 原型固定验证码，便于演示（正式环境由短信网关下发） */
export const PROTOTYPE_OTP = "123456";

export const OTP_LENGTH = 6;
export const OTP_RESEND_SECONDS = 60;
export const OTP_VALID_MS = 5 * 60 * 1000;

export type AuthProfile = {
  phone: string;
  maskedPhone: string;
  nickname: string;
  tenantName: string;
  loggedInAt: string;
};

export function validateMainlandPhone(phone: string): boolean {
  return /^1[3-9]\d{9}$/.test(phone.trim());
}

export function maskPhone(phone: string): string {
  const p = phone.trim();
  if (p.length !== 11) return p;
  return `${p.slice(0, 3)}****${p.slice(7)}`;
}

export function buildProfile(phone: string): AuthProfile {
  const trimmed = phone.trim();
  return {
    phone: trimmed,
    maskedPhone: maskPhone(trimmed),
    nickname: "研究员",
    tenantName: "小窗 · 企业租户",
    loggedInAt: new Date().toISOString(),
  };
}

export function readAuthProfile(): AuthProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthProfile;
  } catch {
    return null;
  }
}

export function writeAuthProfile(profile: AuthProfile): void {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(profile));
}

export function clearAuthProfile(): void {
  localStorage.removeItem(AUTH_STORAGE_KEY);
}

/** 原型会话令牌：HttpOnly Cookie 存手机号（正式环境应使用签名 JWT） */
export function encodeSessionToken(phone: string): string {
  return phone.trim();
}

export function decodeSessionToken(token: string): { phone: string } | null {
  const phone = token.trim();
  if (!validateMainlandPhone(phone)) return null;
  return { phone };
}

export function isValidOtp(code: string): boolean {
  const c = code.trim();
  if (!/^\d{6}$/.test(c)) return false;
  return c === PROTOTYPE_OTP;
}
