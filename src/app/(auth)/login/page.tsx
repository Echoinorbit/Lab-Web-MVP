import { FlaskConical } from "lucide-react";
import Image from "next/image";

import labAtmosphere from "@/assets/lab-collaboration-atmosphere.webp";
import { LoginForm } from "@/features/auth";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;
  const notice = reason === "graduated" ? "已毕业，账号已停用。" : null;

  return (
    <main id="main-content" className="grid min-h-screen bg-card lg:grid-cols-[minmax(440px,0.82fr)_1.18fr]">
      <section className="relative z-10 flex min-h-screen items-center justify-center px-6 py-12 sm:px-10 lg:px-12 xl:px-20">
        <div className="w-full max-w-[420px]">
          <div className="mb-14 flex items-center gap-3 text-[15px] font-semibold tracking-[-0.02em]">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-foreground text-background">
              <FlaskConical className="h-[18px] w-[18px]" aria-hidden="true" />
            </span>
            实验室协作
          </div>
          <LoginForm initialNotice={notice} />
          <p className="mt-10 text-xs leading-5 text-muted-foreground">仅限已授权的实验室成员使用。账号状态与权限由系统实时校验。</p>
        </div>
      </section>

      <section className="relative hidden min-h-screen overflow-hidden bg-[#111113] text-white lg:block" aria-label="产品概览">
        <Image
          src={labAtmosphere}
          alt="实验室成员围绕研究资料进行协作"
          fill
          priority
          sizes="(min-width: 1024px) 59vw, 1px"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-black/50" aria-hidden="true" />
        <div className="relative flex h-full min-h-screen flex-col justify-between p-10 xl:p-14">
          <p className="text-sm font-medium text-white/75">研究协作工作台</p>
          <div className="max-w-2xl pb-4">
            <h1 className="text-[44px] font-semibold leading-[1.05] tracking-[-0.045em] xl:text-[56px]">
              让研究推进始终保有清晰上下文。
            </h1>
            <p className="mt-6 max-w-xl text-[17px] leading-7 text-white/72">
              项目节点、实验室权限与月度进度汇聚在同一处，让团队知道发生了什么，也知道下一步该做什么。
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
