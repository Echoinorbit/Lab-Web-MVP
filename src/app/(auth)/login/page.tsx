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
      eyebrow="成员入口"
      title="欢迎回来"
      description="登录后继续处理项目、进度与实验室协作。"
      visualTitle="让研究推进始终保有清晰上下文。"
      visualDescription="项目节点、实验室权限与月度进度汇聚在同一处，让团队看见正在发生什么，也知道下一步该做什么。"
      footer="仅限已授权的实验室成员使用。账号状态与权限由系统实时校验。"
    >
      <LoginForm initialNotice={notice} />
    </AuthShell>
  );
}
