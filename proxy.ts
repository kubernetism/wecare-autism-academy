import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

/**
 * First gate only: sends visitors without a session cookie to the login page.
 * It never decides access. Layouts check the role, and every service function
 * re-checks permissions with `can()` against the database session.
 */
export function proxy(request: NextRequest) {
  if (getSessionCookie(request)) return NextResponse.next();

  const { pathname, search } = request.nextUrl;
  const login = new URL("/login", request.url);
  login.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/app", "/app/:path*", "/portal", "/portal/:path*"],
};
