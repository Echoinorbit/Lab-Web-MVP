import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "@/shared/lib/utils";

type NoticeVariant = "info" | "success" | "warning" | "error";

const variants: Record<NoticeVariant, string> = {
  info: "border-foreground/25 bg-surface text-foreground",
  success: "border-success/50 bg-success/10 text-foreground",
  warning: "border-warning/50 bg-warning/10 text-foreground",
  error: "border-destructive/60 bg-destructive/10 text-foreground",
};

export function StatusNotice({
  title,
  variant = "info",
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & { title?: ReactNode; variant?: NoticeVariant }) {
  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      className={cn("border border-l-[2px] border-l-brand-yellow px-4 py-3 text-[1rem] leading-6", variants[variant], className)}
      {...props}
    >
      {title ? <div className="font-medium">// {title}</div> : null}
      {children ? <div className={cn(title && "mt-0.5 text-muted-foreground")}>{title ? null : "// "}{children}</div> : null}
    </div>
  );
}
