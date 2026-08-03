import { FlaskConical } from "lucide-react";
import Image from "next/image";
import type { ReactNode } from "react";

import labAtmosphere from "@/assets/lab-collaboration-atmosphere.webp";

export function AuthShell({
  eyebrow,
  title,
  description,
  visualTitle,
  visualDescription,
  children,
  footer,
}: {
  eyebrow: string;
  title: string;
  description: string;
  visualTitle: string;
  visualDescription: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main id="main-content" className="grid min-h-screen bg-background lg:grid-cols-[minmax(0,1.25fr)_minmax(440px,0.75fr)]">
      <section className="relative hidden min-h-screen overflow-hidden bg-sidebar text-white lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16" aria-label="产品概览">
        <Image
          src={labAtmosphere}
          alt=""
          fill
          priority
          sizes="(min-width: 1024px) 62vw, 1px"
          className="object-cover opacity-55"
          aria-hidden="true"
        />
        <div className="absolute inset-0 bg-[linear-gradient(135deg,hsl(232_28%_6%/0.95),hsl(232_28%_6%/0.35)_62%,hsl(216_100%_42%/0.38))]" aria-hidden="true" />
        <div className="absolute -bottom-52 -right-44 h-[520px] w-[520px] rounded-full border border-white/15 bg-white/[0.035] backdrop-blur-sm" aria-hidden="true" />
        <div className="absolute -bottom-24 -right-16 h-[280px] w-[280px] rounded-full border border-primary/45 bg-primary/10" aria-hidden="true" />

        <div className="relative flex items-center gap-3 text-[15px] font-semibold tracking-[-0.02em]">
          <span className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-white text-slate-950">
            <FlaskConical className="h-[18px] w-[18px]" aria-hidden="true" />
          </span>
          实验室协作
        </div>

        <div className="relative max-w-3xl pb-8">
          <p className="mb-5 text-xs font-semibold uppercase tracking-[0.16em] text-white/62">Research operations</p>
          <h1 className="max-w-2xl text-[48px] font-semibold leading-[1.01] tracking-[-0.045em] xl:text-[64px]">{visualTitle}</h1>
          <p className="mt-6 max-w-xl text-[17px] leading-7 text-white/70">{visualDescription}</p>
        </div>
      </section>

      <section className="relative flex min-h-screen items-center justify-center px-6 py-12 sm:px-10 lg:px-12 xl:px-16">
        <div className="w-full max-w-[440px]">
          <div className="mb-14 flex items-center gap-3 text-[15px] font-semibold tracking-[-0.02em] lg:hidden">
            <span className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-foreground text-background">
              <FlaskConical className="h-[18px] w-[18px]" aria-hidden="true" />
            </span>
            实验室协作
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">{eyebrow}</p>
          <h1 className="mt-4 text-[40px] font-semibold leading-[1.04] tracking-[-0.04em] sm:text-[48px]">{title}</h1>
          <p className="mt-4 text-[16px] leading-7 text-muted-foreground">{description}</p>
          <div className="mt-9">{children}</div>
          {footer ? <div className="mt-10 text-xs leading-5 text-muted-foreground">{footer}</div> : null}
        </div>
      </section>
    </main>
  );
}
