import { timingSafeEqual } from "node:crypto";

export function isBearerSecretAuthorized(input: {
  authorizationHeader?: string | null;
  secret?: string | null;
}) {
  if (!input.secret) return false;
  const prefix = "Bearer ";
  if (!input.authorizationHeader?.startsWith(prefix)) return false;
  const token = Buffer.from(input.authorizationHeader.slice(prefix.length));
  const secret = Buffer.from(input.secret);
  return token.length === secret.length && timingSafeEqual(token, secret);
}
