import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "@/shared/lib/utils";

type HeadingProps = HTMLAttributes<HTMLDivElement> & {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
};

export function PageHeader({ title, description, actions, className, ...props }: HeadingProps) {
  return (
    <header
      className={cn(
        "flex flex-col gap-5 border-b border-border/70 pb-7 sm:flex-row sm:items-end sm:justify-between sm:gap-8 sm:pb-8",
        className,
      )}
      {...props}
    >
      <div className="min-w-0 max-w-3xl">
        <h1 className="text-[32px] font-semibold leading-[1.08] tracking-[-0.04em] sm:text-[40px]">{title}</h1>
        {description ? <div className="mt-3 max-w-2xl text-[15px] leading-6 text-muted-foreground sm:text-base">{description}</div> : null}
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
        <h2 className="text-xl font-semibold leading-7 tracking-[-0.028em] sm:text-2xl">{title}</h2>
        {description ? <div className="mt-1.5 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</div> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2.5">{actions}</div> : null}
    </div>
  );
}
