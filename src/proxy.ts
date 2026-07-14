import { auth } from "@/auth";

const PROTECTED_PREFIXES = ["/admin", "/upload", "/me"];

export const proxy = auth((req) => {
  const { pathname } = req.nextUrl;
  const needsAuth = PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
  if (needsAuth && !req.auth) {
    const url = new URL("/login", req.nextUrl.origin);
    url.searchParams.set("callbackUrl", pathname);
    return Response.redirect(url);
  }
});

export const config = {
  matcher: ["/admin/:path*", "/upload/:path*", "/me/:path*"],
};
