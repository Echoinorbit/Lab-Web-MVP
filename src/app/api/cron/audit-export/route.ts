import { NextResponse } from "next/server";

import {
  buildAuditExportPlan,
  buildAuditWorkbookBuffer,
  isAuditCronAuthorized,
  resolveAuditExportRangeStart,
} from "@/features/admin/lib/audit-export";
import { getShanghaiDateParts } from "@/shared/lib/date";
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
  const result = await prisma.$transaction(async (tx) => {
    const year = getShanghaiDateParts(now).year;
    const counter = await tx.auditExportCounter.upsert({
      where: { year },
      create: { year },
      update: {},
      select: { exportsInYear: true, cycleCount: true },
    });
    const latestArchive = await tx.auditExportArchive.findFirst({
      orderBy: { rangeEnd: "desc" },
      select: { rangeEnd: true },
    });
    const earliestLog = latestArchive
      ? null
      : await tx.auditLog.findFirst({
          orderBy: { createdAt: "asc" },
          select: { createdAt: true },
        });
    const rangeStart = resolveAuditExportRangeStart({
      previousRangeEnd: latestArchive?.rangeEnd ?? null,
      earliestLogCreatedAt: earliestLog?.createdAt ?? null,
      now,
    });
    const logs = await tx.auditLog.findMany({
      where: { createdAt: { gte: rangeStart, lt: now } },
      orderBy: { createdAt: "asc" },
      select: {
        createdAt: true,
        userId: true,
        action: true,
        entityType: true,
        entityId: true,
        ipAddress: true,
        details: true,
      },
    });
    const plan = buildAuditExportPlan({ counter, rangeStart, rangeEnd: now, now });
    const excelData = await buildAuditWorkbookBuffer(logs);

    await tx.auditExportArchive.create({
      data: {
        fileName: plan.fileName,
        excelData,
        seqInYear: plan.seqInYear,
        rangeStart: plan.rangeStart,
        rangeEnd: plan.rangeEnd,
        rowCount: logs.length,
        expiresAt: plan.expiresAt,
      },
    });

    await tx.auditExportCounter.update({
      where: { year },
      data: {
        exportsInYear: plan.exportsInYear,
        cycleCount: plan.cycleCount,
        lastExportAt: now,
      },
    });

    if (plan.shouldClearAuditLogs) {
      await tx.auditLog.deleteMany({ where: { createdAt: { lt: plan.rangeEnd } } });
    }
    await tx.auditExportArchive.deleteMany({ where: { expiresAt: { lt: now } } });

    return {
      fileName: plan.fileName,
      rowCount: logs.length,
      cycleCount: plan.cycleCount,
      seqInYear: plan.seqInYear,
    };
  });

  return NextResponse.json({ ok: true, ...result });
}
