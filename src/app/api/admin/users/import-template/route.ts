import { buildUserImportTemplate } from "@/features/admin/lib/user-import-template";
import { assertPermissionWithAudit } from "@/shared/lib/authorization";
import { PERMISSIONS } from "@/shared/lib/permissions";
import { requireActiveUser } from "@/shared/lib/session";

export async function GET() {
  const user = await requireActiveUser();
  await assertPermissionWithAudit({
    userId: user.id,
    permission: PERMISSIONS.ADMIN_USER_MANAGE,
    entityType: "UserImportTemplate",
  });
  const buffer = await buildUserImportTemplate();
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": "attachment; filename=member-import-template.xlsx",
      "Cache-Control": "private, no-store",
    },
  });
}
