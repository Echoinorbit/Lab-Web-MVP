import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "@/shared/lib/utils";

type NoticeVariant = "info" | "success" | "warning" | "error";

const variants: Record<NoticeVariant, string> = {
  info: "border-primary/25 bg-primary/5 text-foreground",
  success: "border-success/25 bg-success/10 text-foreground",
  warning: "border-warning/30 bg-warning/10 text-foreground",
  error: "border-destructive/30 bg-destructive/10 text-foreground",
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
      className={cn("rounded-xl border px-4 py-3 text-sm leading-6", variants[variant], className)}
      {...props}
    >
      {title ? <div className="font-semibold">{title}</div> : null}
      {children ? <div className={cn(title && "mt-0.5 text-muted-foreground")}>{children}</div> : null}
    </div>
  );
}
