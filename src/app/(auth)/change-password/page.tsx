import { ChangePasswordForm } from "@/features/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { requireActiveUser } from "@/shared/lib/session";

export default async function ChangePasswordPage() {
  await requireActiveUser({ allowPasswordChange: true });

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
      <Card className="w-full max-w-md">
        <CardHeader className="px-6 py-5">
          <CardTitle className="text-xl tracking-[-0.025em]">修改密码</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <ChangePasswordForm />
        </CardContent>
      </Card>
    </main>
  );
}
