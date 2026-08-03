import { ChangePasswordForm } from "@/features/auth";
import { AuthShell } from "@/shared/components/layout/auth-shell";
import { requireActiveUser } from "@/shared/lib/session";

export default async function ChangePasswordPage() {
  await requireActiveUser({ allowPasswordChange: true });

  return (
    <AuthShell
      eyebrow="账号安全"
      title="修改密码"
      description="至少 10 位，并包含大小写字母、数字或符号中的至少三类。"
      visualTitle="更新凭据，继续安全协作。"
      visualDescription="新密码会立即用于后续登录。请使用与用户名、姓名和学号无关的强密码。"
    >
      <ChangePasswordForm />
    </AuthShell>
  );
}
