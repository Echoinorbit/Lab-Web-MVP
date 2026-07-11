import { redirect } from "next/navigation";
import type { StudyDegree } from "@prisma/client";

import { auth } from "./auth";
import { prisma } from "./prisma";
import type { UserStatusName } from "./user-status";

export type ActiveSessionUser = {
  id: string;
  username: string;
  role: "ADMIN" | "MEMBER";
  mustChangePassword: boolean;
  studyDegree: StudyDegree | null;
  identityNeedsReview: boolean;
};

export type SessionRevocationSnapshot = {
  tokenVersion: number;
  policyExpiresAt?: Date | string | null;
};

export type CurrentUserSnapshot = {
  status: UserStatusName;
  tokenVersion: number;
} | null;

export function isSessionCurrent(
  sessionUser: SessionRevocationSnapshot,
  currentUser: CurrentUserSnapshot,
  now = new Date(),
) {
  const expiresAt = sessionUser.policyExpiresAt ? new Date(sessionUser.policyExpiresAt) : null;
  return Boolean(currentUser)
    && currentUser?.status === "ACTIVE"
    && currentUser.tokenVersion === sessionUser.tokenVersion
    && Boolean(expiresAt && !Number.isNaN(expiresAt.getTime()) && expiresAt > now);
}

export async function requireActiveUser(options: { allowPasswordChange?: boolean } = {}) {
  const session = await auth();
  const sessionUser = session?.user;
  if (!sessionUser?.id) redirect("/login");

  const { user, now } = await prisma.$transaction(async (tx) => {
    const [currentUser, [{ now: databaseNow }]] = await Promise.all([
      tx.user.findUnique({
        where: { id: sessionUser.id },
        select: {
          id: true,
          username: true,
          role: true,
          status: true,
          mustChangePassword: true,
          tokenVersion: true,
          studyDegree: true,
          identityNeedsReview: true,
        },
      }),
      tx.$queryRaw<Array<{ now: Date }>>`SELECT transaction_timestamp() AS now`,
    ]);
    return { user: currentUser, now: databaseNow };
  });

  if (!user || !isSessionCurrent(sessionUser, user, now)) {
    redirect("/login");
  }

  if (user.mustChangePassword && !options.allowPasswordChange) {
    redirect("/change-password");
  }

  return {
    id: user.id,
    username: user.username,
    role: user.role,
    mustChangePassword: user.mustChangePassword,
    studyDegree: user.studyDegree,
    identityNeedsReview: user.identityNeedsReview,
  } satisfies ActiveSessionUser;
}
