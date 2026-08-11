import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { isPublicRoutePrefilterPath } from "@/shared/lib/route-prefilter";

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/") {
    const token = await getToken({ req: request, secret: process.env.AUTH_SECRET });
    if (token) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.rewrite(url);
    }
    return NextResponse.next();
  }

  const isPublic = isPublicRoutePrefilterPath(pathname);

  if (isPublic) return NextResponse.next();

  // This is a route prefilter only; DB-backed status, tokenVersion, and password-change gates run server-side.
  const token = await getToken({ req: request, secret: process.env.AUTH_SECRET });
  if (!token) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
