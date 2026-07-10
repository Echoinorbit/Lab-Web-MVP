import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "@/shared/lib/utils";

type EmptyStateProps = HTMLAttributes<HTMLDivElement> & {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
};

export function EmptyState({ icon, title, description, action, className, ...props }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex min-h-48 flex-col items-center justify-center border-y border-dashed border-border px-5 py-12 text-center",
        className,
      )}
      {...props}
    >
      {icon ? <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">{icon}</div> : null}
      <h2 className="text-lg font-semibold tracking-[-0.022em]">{title}</h2>
      {description ? <div className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">{description}</div> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
