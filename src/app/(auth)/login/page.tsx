import Image from "next/image";

import labAtmosphere from "@/assets/lab-collaboration-atmosphere.webp";
import { LoginForm } from "@/features/auth";

const transparentPixel = "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;
  const notice = reason === "graduated" ? "已毕业，账号已停用。" : null;

  return (
    <main className="grid min-h-screen bg-card lg:grid-cols-[minmax(440px,0.86fr)_1.14fr]">
      <section className="relative z-10 flex items-center justify-center bg-card px-6 py-12 sm:px-10 lg:px-12 xl:px-16">
        <LoginForm initialNotice={notice} />
      </section>
      <section className="relative hidden min-h-screen overflow-hidden bg-[#111113] p-10 text-white lg:block xl:p-14" aria-label="产品概览">
        <picture className="pointer-events-none absolute inset-0" aria-hidden="true">
          <source media="(min-width: 1024px)" srcSet={labAtmosphere.src} />
          <Image
            src={transparentPixel}
            alt=""
            aria-hidden="true"
            role="presentation"
            width={labAtmosphere.width}
            height={labAtmosphere.height}
            sizes="(min-width: 1024px) 57vw, 1px"
            decoding="async"
            fetchPriority="low"
            unoptimized
            className="h-full w-full object-cover"
          />
        </picture>

        <div className="relative mx-auto flex h-full max-w-4xl flex-col justify-between">
          <div className="flex items-center gap-2 text-xs font-medium text-white/72">
            <span className="h-2 w-2 rounded-full bg-[#0066cc]" aria-hidden="true" />
            研究协作工作台
          </div>

          <div className="max-w-xl rounded-[24px] border border-white/14 bg-black/65 p-8 shadow-[0_12px_32px_rgb(0_0_0_/_0.22)] xl:p-10">
            <h2 className="text-[40px] font-semibold leading-[1.08] tracking-[-0.04em] xl:text-5xl">
              让每一次研究推进，都有清晰上下文。
            </h2>
            <p className="mt-5 max-w-lg text-[16px] leading-7 text-white/68">
              项目节点、实验室权限与月度进度汇聚在同一处，团队始终知道正在发生什么。
            </p>

            <div className="mt-8 grid grid-cols-3 gap-px overflow-hidden rounded-2xl border border-white/12 bg-white/12">
              <div className="bg-black/55 px-4 py-4">
                <div className="text-xs text-white/50">项目脉络</div>
                <div className="mt-1.5 text-sm font-medium">节点可追溯</div>
              </div>
              <div className="bg-black/55 px-4 py-4">
                <div className="text-xs text-white/50">协作权限</div>
                <div className="mt-1.5 text-sm font-medium">范围清晰</div>
              </div>
              <div className="bg-black/55 px-4 py-4">
                <div className="text-xs text-white/50">进度状态</div>
                <div className="mt-1.5 text-sm font-medium">及时汇总</div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
