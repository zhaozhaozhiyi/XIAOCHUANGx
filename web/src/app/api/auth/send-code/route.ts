import { NextResponse } from "next/server";
import { validateMainlandPhone } from "@/lib/auth";

export async function POST(request: Request) {
  let body: { phone?: string };
  try {
    body = (await request.json()) as { phone?: string };
  } catch {
    return NextResponse.json({ error: "请求格式错误" }, { status: 400 });
  }

  const phone = body.phone?.trim() ?? "";
  if (!validateMainlandPhone(phone)) {
    return NextResponse.json(
      { error: "请输入正确的 11 位手机号" },
      { status: 400 },
    );
  }

  return NextResponse.json({
    ok: true,
    message: "验证码已发送（原型环境）",
    expiresIn: 300,
  });
}
