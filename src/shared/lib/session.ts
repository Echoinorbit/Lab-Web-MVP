import { redirect } from "next/navigation";

import { auth } from "./auth";
import { graduateUserAccount, shouldGraduateByComputedGrade } from "./graduation";
import { prisma } from "./prisma";
import type { UserStatusName } from "./user-status";

export type ActiveSessionUser = {
  id: string;
  username: string;
  role: "ADMIN" | "MEMBER";
  mustChangePassword: boolean;
};

export type SessionRevocationSnapshot = {
  tokenVersion: number;
};

export type CurrentUserSnapshot = {
  status: UserStatusName;
  tokenVersion: number;
} | null;

export function isSessionCurrent(
  sessionUser: SessionRevocationSnapshot,
  currentUser: CurrentUserSnapshot,
) {
  return Boolean(currentUser) && currentUser?.status === "ACTIVE" && currentUser.tokenVersion === sessionUser.tokenVersion;
}

export async function requireActiveUser(options: { allowPasswordChange?: boolean } = {}) {
  const session = await auth();
  const sessionUser = session?.user;
  if (!sessionUser?.id) redirect("/login");

  const now = new Date();
  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: {
      id: true,
      username: true,
      role: true,
      status: true,
      mustChangePassword: true,
      tokenVersion: true,
      enrollmentDate: true,
      tags: {
        where: {
          revokedAt: null,
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
        select: {
          projectId: true,
          tag: { select: { name: true } },
        },
      },
    },
  });

  if (user && shouldGraduateByComputedGrade(user, now)) {
    await prisma.$transaction(async (tx) => {
      await graduateUserAccount(tx, user.id, now);
    });
    redirect("/login?reason=graduated");
  }

  if (!user || !isSessionCurrent(sessionUser, user)) {
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
  } satisfies ActiveSessionUser;
}
