import { LoginForm } from "@/features/auth";
import { AuthShell } from "@/shared/components/layout/auth-shell";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;
  const notice = reason === "graduated" ? "已毕业，账号已停用。" : null;

  return (
    <AuthShell
      eyebrow="研究搭子已就位"
      title="一起把下一步想清楚"
      description="登录后继续整理项目、进度与每一次协作。"
      visualTitle="研究，也可以有同伴。"
      visualDescription="把手边的想法、任务和下一步留在一起。慢一点没关系，我们一起推进。"
      footer="仅限授权成员使用。账号状态与权限由系统实时校验。"
    >
      <LoginForm initialNotice={notice} />
    </AuthShell>
  );
}
