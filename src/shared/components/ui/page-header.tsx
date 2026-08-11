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
        "relative flex flex-col gap-6 border-y border-border bg-card px-8 py-8 before:absolute before:inset-y-0 before:left-0 before:w-[2px] before:bg-brand-yellow landscape:flex-row landscape:items-end landscape:justify-between landscape:gap-10 portrait:px-6",
        className,
      )}
      {...props}
    >
      <div className="min-w-0 max-w-4xl">
        <h1 className="font-bold text-[3rem] leading-none">{title}</h1>
        {description ? <div className="mt-4 max-w-3xl text-[1rem] leading-7 text-muted-foreground">{description}</div> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2.5">{actions}</div> : null}
    </header>
  );
}

export function SectionHeader({ title, description, actions, className, ...props }: HeadingProps) {
  return (
    <div
      className={cn("flex flex-col gap-3 border-b border-border pb-5 landscape:flex-row landscape:items-end landscape:justify-between landscape:gap-6", className)}
      {...props}
    >
      <div className="min-w-0">
        <h2 className="font-medium text-[2rem] leading-none">{title}</h2>
        {description ? <div className="mt-3 max-w-2xl font-mono text-[.8125rem] uppercase leading-6 tracking-[.04em] text-muted-foreground">// {description}</div> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2.5">{actions}</div> : null}
    </div>
  );
}
