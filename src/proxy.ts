import { NextResponse, type NextRequest } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  readAdminSessionToken,
  sanitizeNextPath,
} from "@/lib/auth-session";

export function proxy(request: NextRequest) {
  const session = readAdminSessionToken(
    request.cookies.get(ADMIN_SESSION_COOKIE)?.value,
  );
  const pathname = request.nextUrl.pathname;

  if (pathname === "/login") {
    if (session) {
      return NextResponse.redirect(
        new URL(sanitizeNextPath(request.nextUrl.searchParams.get("next")), request.url),
      );
    }

    return NextResponse.next();
  }

  if (session) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set(
    "next",
    `${request.nextUrl.pathname}${request.nextUrl.search}`,
  );

  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/",
    "/licenses/:path*",
    "/sites/:path*",
    "/releases/:path*",
    "/policies/:path*",
    "/login",
  ],
};
