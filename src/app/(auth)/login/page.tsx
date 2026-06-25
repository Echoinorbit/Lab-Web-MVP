import { LoginForm } from "@/features/auth";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;
  const notice = reason === "graduated" ? "已毕业，账号已停用。" : null;

  return (
    <main className="grid min-h-screen bg-background lg:grid-cols-[minmax(360px,520px)_1fr]">
      <section className="flex items-center justify-center px-6 py-10">
        <LoginForm initialNotice={notice} />
      </section>
      <section className="hidden border-l bg-card p-10 lg:block">
        <div className="grid h-full content-center gap-4">
          <div className="rounded-lg border bg-background p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-semibold">项目时间线</div>
              <div className="rounded bg-secondary px-2 py-1 text-xs">IN_PROGRESS</div>
            </div>
            <div className="space-y-3 text-sm">
              <div className="border-l-4 border-l-primary pl-3">
                <div className="font-medium">完成数据清洗</div>
                <div className="text-xs text-muted-foreground">张三 · 2026-06-14</div>
              </div>
              <div className="ml-5 border-l-4 border-l-destructive pl-3">
                <div className="font-medium">DICOM 格式转换阻塞</div>
                <div className="text-xs text-muted-foreground">王五 · 2026-06-13</div>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg border bg-background p-4">
              <div className="text-xs text-muted-foreground">进度提交</div>
              <div className="mt-2 text-3xl font-semibold">86%</div>
            </div>
            <div className="rounded-lg border bg-background p-4">
              <div className="text-xs text-muted-foreground">待审 Tag</div>
              <div className="mt-2 text-3xl font-semibold">3</div>
            </div>
          </div>
          <div className="rounded-lg border bg-background p-4 text-sm">
            <div className="mb-2 font-semibold">进度汇总</div>
            <div className="grid grid-cols-[1fr_1fr_88px] gap-2 border-b py-2 text-xs text-muted-foreground">
              <span>学生</span>
              <span>导师</span>
              <span>状态</span>
            </div>
            <div className="grid grid-cols-[1fr_1fr_88px] gap-2 py-2 text-sm">
              <span>张三</span>
              <span>李教授</span>
              <span>已提交</span>
            </div>
            <div className="grid grid-cols-[1fr_1fr_88px] gap-2 py-2 text-sm">
              <span>王五</span>
              <span>李教授</span>
              <span>草稿</span>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
