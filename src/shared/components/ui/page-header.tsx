import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "@/shared/lib/utils";

type HeadingProps = Omit<HTMLAttributes<HTMLDivElement>, "title"> & {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
};

export function PageHeader({ title, description, actions, className, ...props }: HeadingProps) {
  return (
    <header
      className={cn(
        "relative flex flex-col gap-5 border-b border-border/75 pb-7 sm:flex-row sm:items-end sm:justify-between sm:gap-10",
        className,
      )}
      {...props}
    >
      <div className="min-w-0 max-w-4xl">
        <h1 className="text-[34px] font-semibold leading-[1.08] tracking-[-0.04em] sm:text-[44px]">{title}</h1>
        {description ? <div className="mt-3 max-w-3xl text-[15px] leading-7 text-muted-foreground sm:text-[16px]">{description}</div> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2.5">{actions}</div> : null}
    </header>
  );
}

export function SectionHeader({ title, description, actions, className, ...props }: HeadingProps) {
  return (
    <div
      className={cn("flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-6", className)}
      {...props}
    >
      <div className="min-w-0">
        <h2 className="text-[21px] font-semibold leading-7 tracking-[-0.032em] sm:text-[24px]">{title}</h2>
        {description ? <div className="mt-1.5 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</div> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2.5">{actions}</div> : null}
    </div>
  );
}
