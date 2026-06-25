import { requirePermission } from "@/shared/lib/authorization";
import { PERMISSIONS } from "@/shared/lib/permissions";
import { prisma } from "@/shared/lib/prisma";
import { buildAuditExportContentDisposition } from "@/features/admin/lib/audit-export";

const EXCEL_MIME_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  await requirePermission({
    permission: PERMISSIONS.ADMIN_AUDIT_VIEW,
    entityType: "AuditExportArchive",
    entityId: id,
  });

  const archive = await prisma.auditExportArchive.findUnique({
    where: { id },
    select: { fileName: true, excelData: true },
  });
  if (!archive) return new Response(null, { status: 404 });

  return new Response(new Uint8Array(archive.excelData), {
    headers: {
      "Content-Type": EXCEL_MIME_TYPE,
      "Content-Disposition": buildAuditExportContentDisposition(archive.fileName),
      "X-Content-Type-Options": "nosniff",
    },
  });
}
