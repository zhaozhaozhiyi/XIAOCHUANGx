import { NextResponse } from "next/server";
import {
  AUTH_COOKIE,
  buildProfile,
  encodeSessionToken,
  isValidOtp,
  validateMainlandPhone,
} from "@/lib/auth";

const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

export async function POST(request: Request) {
  let body: { phone?: string; code?: string; agreed?: boolean };
  try {
    body = (await request.json()) as {
      phone?: string;
      code?: string;
      agreed?: boolean;
    };
  } catch {
    return NextResponse.json({ error: "请求格式错误" }, { status: 400 });
  }

  const phone = body.phone?.trim() ?? "";
  const code = body.code?.trim() ?? "";

  if (!validateMainlandPhone(phone)) {
    return NextResponse.json(
      { error: "请输入正确的 11 位手机号" },
      { status: 400 },
    );
  }

  if (!body.agreed) {
    return NextResponse.json(
      { error: "请先阅读并同意用户协议与隐私政策" },
      { status: 400 },
    );
  }

  if (!isValidOtp(code)) {
    return NextResponse.json(
      { error: "验证码错误或已失效，请重新获取" },
      { status: 400 },
    );
  }

  const profile = buildProfile(phone);
  const token = encodeSessionToken(phone);
  const response = NextResponse.json({ ok: true, profile });

  response.cookies.set(AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });

  return response;
}
