const PUBLIC_ROUTE_PREFIXES = ["/", "/login", "/api/auth", "/avatar", "/uploads", "/mostar"] as const;

export function isPublicRoutePrefilterPath(pathname: string) {
  return PUBLIC_ROUTE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}
