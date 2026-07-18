import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "./auth.config";

const { auth } = NextAuth(authConfig);

const SESSION_COOKIES = [
  "authjs.session-token",
  "__Secure-authjs.session-token",
  "next-auth.session-token",
  "__Secure-next-auth.session-token",
];

function clearSessionCookies(res: NextResponse) {
  for (const name of SESSION_COOKIES) {
    res.cookies.set(name, "", { path: "/", maxAge: 0 });
  }
}

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth;

  const hasSessionCookie = SESSION_COOKIES.some((name) => req.cookies.has(name));

  // Bozuk / eski secret ile imzalanmış JWT → JWTSessionError; çerezi temizle
  if (hasSessionCookie && !isLoggedIn) {
    const isPublic =
      pathname.startsWith("/giris") ||
      pathname.startsWith("/api/auth") ||
      pathname.startsWith("/api/mobile") ||
      pathname.startsWith("/api/v1");

    if (isPublic) {
      const res = NextResponse.next();
      clearSessionCookies(res);
      return res;
    }

    const url = new URL("/giris", req.nextUrl.origin);
    url.searchParams.set("callbackUrl", pathname);
    const res = NextResponse.redirect(url);
    clearSessionCookies(res);
    return res;
  }

  const isPublic =
    pathname.startsWith("/giris") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/mobile") ||
    pathname.startsWith("/api/v1");

  if (!isPublic && !isLoggedIn) {
    const url = new URL("/giris", req.nextUrl.origin);
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|svg)).*)"],
};
