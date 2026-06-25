import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";

import { appendAuditLog } from "./audit";
import { getEffectiveTags, getUserPermissions } from "./permissions";
import { prisma } from "./prisma";
import { verifyPasswordWithDummyFallback } from "./security";
import { resolveSessionStatus } from "./user-status";
import { loginSchema } from "./validators/auth";

export const LOCK_MINUTES = 3;
const MAX_LOGIN_ATTEMPTS = 5;
export const IP_FAILURE_LIMIT_PER_MINUTE = 30;
const TRUSTED_PROXY_HOPS_ENV = "TRUSTED_PROXY_HOPS";

async function failLogin(input: {
  userId?: string | null;
  username: string;
  reason: "invalid" | "locked" | "suspended" | "ip-rate-limited";
  ipAddress?: string | null;
}) {
  await appendAuditLog({
    userId: input.userId,
    action: input.reason === "locked" ? "ACCOUNT_LOCKED" : "LOGIN_FAILED",
    entityType: "User",
    entityId: input.userId,
    details: { username: input.username, reason: input.reason },
    ipAddress: input.ipAddress,
  });
  return null;
}

function getMinuteWindowStart(date = new Date()) {
  return new Date(Math.floor(date.getTime() / 60_000) * 60_000);
}

type IpLoginFailureReservation = {
  ipAddress: string;
  windowStart: Date;
  count: number;
};

export type ClientIpHeaderValues = {
  xForwardedFor?: string | null;
  xRealIp?: string | null;
  cfConnectingIp?: string | null;
};

export function parseTrustedProxyHops(value: string | null | undefined) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
}

export function selectClientIpFromHeaders(
  input: ClientIpHeaderValues,
  trustedProxyHops = 0,
) {
  if (trustedProxyHops <= 0) return "unknown";

  const chain = (input.xForwardedFor ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (chain.length <= trustedProxyHops) return "unknown";

  const index = chain.length - trustedProxyHops;
  return chain[index] ?? "unknown";
}

function getClientIp(request: Request) {
  return selectClientIpFromHeaders(
    {
      xForwardedFor: request.headers.get("x-forwarded-for"),
      xRealIp: request.headers.get("x-real-ip"),
      cfConnectingIp: request.headers.get("cf-connecting-ip"),
    },
    parseTrustedProxyHops(process.env[TRUSTED_PROXY_HOPS_ENV]),
  );
}

export function isIpLoginFailureRateLimited(count: number) {
  return count > IP_FAILURE_LIMIT_PER_MINUTE;
}

async function reserveIpLoginFailureSlot(ipAddress: string): Promise<IpLoginFailureReservation | null> {
  if (ipAddress === "unknown") return null;
  const windowStart = getMinuteWindowStart();
  const counter = await prisma.ipLoginFailureCounter.upsert({
    where: {
      ipAddress_windowStart: {
        ipAddress,
        windowStart,
      },
    },
    create: {
      ipAddress,
      windowStart,
      count: 1,
    },
    update: {
      count: { increment: 1 },
    },
  });
  return {
    ipAddress,
    windowStart,
    count: counter.count,
  };
}

async function releaseIpLoginFailureSlot(reservation: IpLoginFailureReservation | null) {
  if (!reservation) return;
  await prisma.ipLoginFailureCounter.updateMany({
    where: {
      ipAddress: reservation.ipAddress,
      windowStart: reservation.windowStart,
      count: { gt: 0 },
    },
    data: {
      count: { decrement: 1 },
    },
  });
}

export function resolveFailedLoginUpdate(
  input: { loginAttempts: number; lockedUntil?: Date | null },
  now = new Date(),
) {
  if (input.lockedUntil && input.lockedUntil > now) {
    return {
      loginAttempts: input.loginAttempts,
      lockedUntil: input.lockedUntil,
      revokeSessions: false,
    };
  }

  const currentAttempts = input.lockedUntil && input.lockedUntil <= now ? 0 : input.loginAttempts;
  const loginAttempts = currentAttempts + 1;
  const lockedUntil =
    loginAttempts >= MAX_LOGIN_ATTEMPTS ? new Date(now.getTime() + LOCK_MINUTES * 60_000) : null;

  return {
    loginAttempts,
    lockedUntil,
    revokeSessions: Boolean(lockedUntil),
  };
}

async function incrementFailedLogin(userId: string) {
  await prisma.$transaction(async (tx) => {
    const [user] = await tx.$queryRaw<Array<{ loginAttempts: number; lockedUntil: Date | null }>>`
      SELECT "loginAttempts", "lockedUntil"
      FROM "User"
      WHERE "id" = ${userId}
      FOR UPDATE
    `;
    if (!user) return;

    const next = resolveFailedLoginUpdate(user);
    await tx.user.update({
      where: { id: userId },
      data: {
        loginAttempts: next.loginAttempts,
        lockedUntil: next.lockedUntil,
        ...(next.revokeSessions ? { tokenVersion: { increment: 1 } } : {}),
      },
    });
  });
}

export const authConfig = {
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60,
    updateAge: 60 * 60,
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials, request) => {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { username, password } = parsed.data;
        const ipAddress = getClientIp(request);
        const ipFailureReservation = await reserveIpLoginFailureSlot(ipAddress);
        if (ipFailureReservation && isIpLoginFailureRateLimited(ipFailureReservation.count)) {
          await verifyPasswordWithDummyFallback(password);
          return failLogin({ username, reason: "ip-rate-limited", ipAddress });
        }

        const user = await prisma.user.findUnique({
          where: { username },
          select: {
            id: true,
            username: true,
            passwordHash: true,
            displayName: true,
            role: true,
            status: true,
            mustChangePassword: true,
            tokenVersion: true,
            lockedUntil: true,
          },
        });

        if (!user) {
          await verifyPasswordWithDummyFallback(password);
          return failLogin({ username, reason: "invalid", ipAddress });
        }

        if (user.lockedUntil && user.lockedUntil > new Date()) {
          await verifyPasswordWithDummyFallback(password, user.passwordHash);
          return failLogin({ userId: user.id, username, reason: "locked", ipAddress });
        }

        if (user.status !== "ACTIVE") {
          await verifyPasswordWithDummyFallback(password, user.passwordHash);
          return failLogin({ userId: user.id, username, reason: "suspended", ipAddress });
        }

        const passwordOk = await verifyPasswordWithDummyFallback(password, user.passwordHash);
        if (!passwordOk) {
          await incrementFailedLogin(user.id);
          return failLogin({ userId: user.id, username, reason: "invalid", ipAddress });
        }

        await prisma.user.update({
          where: { id: user.id },
          data: {
            loginAttempts: 0,
            lockedUntil: null,
            lastLoginAt: new Date(),
          },
        });
        await appendAuditLog({
          userId: user.id,
          action: "LOGIN",
          entityType: "User",
          entityId: user.id,
        });
        await releaseIpLoginFailureSlot(ipFailureReservation);

        return {
          id: user.id,
          username: user.username,
          name: user.displayName,
          role: user.role,
          status: user.status,
          mustChangePassword: user.mustChangePassword,
          tokenVersion: user.tokenVersion,
        };
      },
    }),
  ],
  callbacks: {
    jwt: async ({ token, user }) => {
      if (user) {
        token.username = user.username;
        token.role = user.role;
        token.status = user.status;
        token.mustChangePassword = user.mustChangePassword;
        token.tokenVersion = user.tokenVersion;
      }
      return token;
    },
    session: async ({ session, token }) => {
      if (!token.sub) return session;
      const currentUser = await prisma.user.findUnique({
        where: { id: token.sub },
        select: {
          username: true,
          role: true,
          status: true,
          mustChangePassword: true,
          tokenVersion: true,
        },
      });

      const tokenVersion = Number(token.tokenVersion ?? -1);
      const isCurrent =
        Boolean(currentUser) &&
        currentUser?.status === "ACTIVE" &&
        currentUser.tokenVersion === tokenVersion;
      const permissions = isCurrent ? await getUserPermissions(token.sub) : new Set<string>();
      const tags = isCurrent ? await getEffectiveTags(token.sub) : [];

      session.user.id = token.sub;
      session.user.username = currentUser?.username ?? String(token.username ?? "");
      session.user.role = currentUser?.role ?? (token.role === "ADMIN" ? "ADMIN" : "MEMBER");
      session.user.status = resolveSessionStatus(currentUser?.status, isCurrent);
      session.user.mustChangePassword = currentUser?.mustChangePassword ?? true;
      session.user.tokenVersion = currentUser?.tokenVersion ?? tokenVersion;
      session.user.permissions = [...permissions];
      session.user.tags = tags;
      return session;
    },
  },
} satisfies NextAuthConfig;

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
