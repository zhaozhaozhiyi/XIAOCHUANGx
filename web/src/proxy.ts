import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AUTH_COOKIE, decodeSessionToken } from "@/lib/auth";

function hasValidSession(request: NextRequest): boolean {
  const token = request.cookies.get(AUTH_COOKIE)?.value;
  if (!token) return false;
  return decodeSessionToken(token) !== null;
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/api/auth") ||
    pathname === "/api/runtime/health" ||
    pathname.match(/\.(svg|png|jpg|jpeg|gif|webp|ico|mp4|webm|mov|ogg)$/)
  ) {
    return NextResponse.next();
  }

  const loggedIn = hasValidSession(request);

  if (pathname === "/login") {
    if (loggedIn) {
      return NextResponse.redirect(new URL("/chat", request.url));
    }
    return NextResponse.next();
  }

  if (pathname === "/") {
    return NextResponse.redirect(
      new URL(loggedIn ? "/chat" : "/login", request.url),
    );
  }

  if (!loggedIn) {
    const login = new URL("/login", request.url);
    const redirectTarget = pathname + search;
    if (redirectTarget && redirectTarget !== "/") {
      login.searchParams.set("redirect", redirectTarget);
    }
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
