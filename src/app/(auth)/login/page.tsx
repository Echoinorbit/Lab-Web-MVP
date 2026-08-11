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
      eyebrow="实验室协作管理平台"
      title="进入工作台"
      description="继续处理项目、进度、公告与协作事项。"
      visualTitle="让研究的每一步，都有可以回看的位置。"
      visualDescription="项目、进度与治理信息在同一个受保护的工作台中保持连贯，让协作从容地向前推进。"
      footer="仅限授权成员使用。账号状态与权限由系统实时校验。"
    >
      <LoginForm initialNotice={notice} />
    </AuthShell>
  );
}
