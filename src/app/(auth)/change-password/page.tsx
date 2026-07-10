import { KeyRound } from "lucide-react";

import { ChangePasswordForm } from "@/features/auth";
import { requireActiveUser } from "@/shared/lib/session";

export default async function ChangePasswordPage() {
  await requireActiveUser({ allowPasswordChange: true });

  return (
    <main id="main-content" className="grid min-h-screen bg-card lg:grid-cols-[minmax(0,1fr)_minmax(440px,0.72fr)]">
      <section className="hidden items-end bg-[#111113] p-12 text-white lg:flex xl:p-16">
        <div className="max-w-xl">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-[#111113]">
            <KeyRound className="h-5 w-5" aria-hidden="true" />
          </span>
          <h1 className="mt-8 text-[44px] font-semibold leading-[1.06] tracking-[-0.04em]">更新凭据，继续安全协作。</h1>
          <p className="mt-5 text-[16px] leading-7 text-white/68">新密码会立即用于后续登录。请使用与用户名、姓名和学号无关的强密码。</p>
        </div>
      </section>
      <section className="flex min-h-screen items-center justify-center px-6 py-12 sm:px-10 lg:px-14">
        <div className="w-full max-w-md">
          <p className="text-sm font-medium text-primary">账号安全</p>
          <h1 className="mt-3 text-[36px] font-semibold leading-[1.1] tracking-[-0.04em]">修改密码</h1>
          <p className="mt-3 text-[15px] leading-6 text-muted-foreground">至少 10 位，并包含大小写字母、数字或符号中的至少三类。</p>
          <div className="mt-9">
            <ChangePasswordForm />
          </div>
        </div>
      </section>
    </main>
  );
}
