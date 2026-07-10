import { LoginForm } from "@/features/auth";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;
  const notice = reason === "graduated" ? "已毕业，账号已停用。" : null;

  return (
    <main className="grid min-h-screen bg-card lg:grid-cols-[minmax(420px,0.78fr)_1.22fr]">
      <section className="flex items-center justify-center px-6 py-14 sm:px-10 lg:px-12 xl:px-16">
        <LoginForm initialNotice={notice} />
      </section>
      <section className="hidden bg-[#111113] p-10 text-white lg:block xl:p-16" aria-label="产品概览">
        <div className="mx-auto grid h-full max-w-3xl content-center">
          <div className="mb-12 max-w-2xl">
            <h2 className="text-[40px] font-semibold leading-[1.12] tracking-[-0.035em] xl:text-5xl">
              让实验室协作，始终清晰可见。
            </h2>
            <p className="mt-5 max-w-xl text-[17px] leading-7 text-white/60">
              从项目节点到月度进度，让信息、权限与协作状态始终清楚可见。
            </p>
          </div>

          <div className="rounded-[18px] border border-white/10 bg-[#1d1d1f] p-8 xl:p-10">
            <div className="mb-6 flex items-center justify-between border-b border-white/10 pb-4">
              <div className="text-[17px] font-semibold tracking-[-0.018em]">项目时间线</div>
              <div className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/70">进行中</div>
            </div>
            <div className="space-y-5 text-sm">
              <div className="relative pl-5 before:absolute before:left-0 before:top-1.5 before:h-2.5 before:w-2.5 before:rounded-full before:bg-primary">
                <div className="font-medium">完成数据清洗</div>
                <div className="mt-1 text-xs tabular-nums text-white/50">张三 · 2026-06-14</div>
              </div>
              <div className="relative ml-5 pl-5 before:absolute before:left-0 before:top-1.5 before:h-2.5 before:w-2.5 before:rounded-full before:bg-destructive">
                <div className="font-medium">DICOM 格式转换阻塞</div>
                <div className="mt-1 text-xs tabular-nums text-white/50">王五 · 2026-06-13</div>
              </div>
            </div>
            <div className="my-8 grid grid-cols-2 border-y border-white/10">
              <div className="py-5 pr-5">
                <div className="text-sm text-white/50">进度提交</div>
                <div className="mt-1 text-2xl font-semibold tabular-nums tracking-[-0.03em]">86%</div>
              </div>
              <div className="border-l border-white/10 py-5 pl-5">
                <div className="text-sm text-white/50">待审 Tag</div>
                <div className="mt-1 text-2xl font-semibold tabular-nums tracking-[-0.03em]">3</div>
              </div>
            </div>
            <div className="text-sm">
              <div className="mb-2 font-semibold">进度汇总</div>
              <div className="grid grid-cols-[1fr_1fr_88px] gap-2 border-b border-white/10 py-2.5 text-xs font-medium text-white/50">
                <span>学生</span>
                <span>导师</span>
                <span>状态</span>
              </div>
              <div className="grid grid-cols-[1fr_1fr_88px] gap-2 border-b border-white/10 py-3 text-sm">
                <span>张三</span>
                <span>李教授</span>
                <span>已提交</span>
              </div>
              <div className="grid grid-cols-[1fr_1fr_88px] gap-2 py-3 text-sm">
                <span>王五</span>
                <span>李教授</span>
                <span>草稿</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
