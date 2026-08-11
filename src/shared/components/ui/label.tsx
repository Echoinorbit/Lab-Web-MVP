import type { LabelHTMLAttributes } from "react";

import { cn } from "@/shared/lib/utils";

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("font-mono text-[.875rem] uppercase tracking-[.05em] text-muted-foreground", className)} {...props} />;
}
