// src/middleware.ts
// Première barrière de protection des espaces Acheteur, Vendeur et Admin.
// Les pages et les routes API revérifient aussi le rôle via requireRole().

import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (!token) {
    const loginUrl = new URL("/connexion", request.url);
    loginUrl.searchParams.set("callbackUrl", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  const role = token.role;
  const deniedUrl = new URL("/?erreur=acces-refuse", request.url);

  if (pathname.startsWith("/admin") && role !== "ADMIN") {
    return NextResponse.redirect(deniedUrl);
  }

  if (pathname.startsWith("/vendeur") && role !== "SELLER" && role !== "ADMIN") {
    return NextResponse.redirect(deniedUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/acheteur/:path*", "/vendeur/:path*", "/admin/:path*"],
};
