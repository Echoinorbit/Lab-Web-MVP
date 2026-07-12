import { NextResponse } from "next/server";

import {
  executeAuditExport,
  isAuditCronAuthorized,
} from "@/features/admin/lib/audit-export";
import { prisma } from "@/shared/lib/prisma";

export async function POST(request: Request) {
  if (
    !isAuditCronAuthorized({
      authorizationHeader: request.headers.get("authorization"),
      secret: process.env.CRON_SECRET,
    })
  ) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const now = new Date();
  const result = await prisma.$transaction((tx) => executeAuditExport(tx, now));

  return NextResponse.json({ ok: true, ...result });
}
