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

/**
 * Middleware oturum çerezi taşımayan istekleri /giris'e yönlendirir. Native
 * istemciler Bearer JWT ile geldiği için bu yolların middleware'i geçip
 * doğrulamayı route handler'ında (withPanelUser / withApiUser) yapması gerekir.
 */
function bypassesSessionCheck(req: Parameters<Parameters<typeof auth>[0]>[0]): boolean {
  const { pathname } = req.nextUrl;
  if (
    pathname.startsWith("/giris") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/mobile") ||
    pathname.startsWith("/api/v1")
  ) {
    return true;
  }
  return req.headers.get("authorization")?.startsWith("Bearer ") ?? false;
}

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const isPublic = bypassesSessionCheck(req);

  const hasSessionCookie = SESSION_COOKIES.some((name) => req.cookies.has(name));

  // Bozuk / eski secret ile imzalanmış JWT → JWTSessionError; çerezi temizle
  if (hasSessionCookie && !isLoggedIn) {
    if (isPublic) {
      const res = NextResponse.next();
      clearSessionCookies(res);
      return res;
    }

    const res = unauthenticated(req);
    clearSessionCookies(res);
    return res;
  }

  if (!isPublic && !isLoggedIn) {
    return unauthenticated(req);
  }
  return NextResponse.next();
});

/** API istekleri JSON 401 alır; sayfa istekleri login'e yönlenir. */
function unauthenticated(
  req: Parameters<Parameters<typeof auth>[0]>[0],
): NextResponse {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  }
  const url = new URL("/giris", req.nextUrl.origin);
  url.searchParams.set("callbackUrl", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|svg)).*)"],
};
