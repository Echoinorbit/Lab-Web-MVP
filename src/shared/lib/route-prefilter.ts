const PUBLIC_ROUTE_PREFIXES = ["/", "/_endfield", "/login", "/api/auth", "/avatar", "/uploads", "/brand-mark.jpg"] as const;

export function isPublicRoutePrefilterPath(pathname: string) {
  return PUBLIC_ROUTE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}
