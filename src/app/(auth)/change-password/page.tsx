import { ChangePasswordForm } from "@/features/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { requireActiveUser } from "@/shared/lib/session";

export default async function ChangePasswordPage() {
  await requireActiveUser({ allowPasswordChange: true });

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>修改密码</CardTitle>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>
    </main>
  );
}
