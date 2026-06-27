import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { AUTH_COOKIE, buildProfile, decodeSessionToken } from "@/lib/auth";

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE)?.value;
  const session = token ? decodeSessionToken(token) : null;

  if (!session) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  return NextResponse.json({ profile: buildProfile(session.phone) });
}
