import { type ButtonHTMLAttributes, forwardRef } from "react";

import { cn } from "@/shared/lib/utils";

type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive";
type ButtonSize = "default" | "small" | "icon";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

const variants: Record<ButtonVariant, string> = {
  primary: "border-primary bg-primary text-primary-foreground hover:border-primary/90 hover:bg-primary/90 active:bg-primary/80",
  secondary:
    "border-border bg-card text-foreground hover:border-primary/35 hover:bg-secondary active:bg-secondary/80",
  ghost:
    "border-transparent bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground active:bg-muted/75",
  destructive:
    "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/90 active:bg-destructive/80",
};

const sizes: Record<ButtonSize, string> = {
  default: "h-11 px-4",
  small: "h-9 px-3 text-[13px]",
  icon: "h-10 w-10 px-0",
};

export function buttonStyles({
  variant = "primary",
  size = "default",
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} = {}) {
  return cn(
    "ui-pressable inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg border text-[15px] font-medium transition-[transform,color,background-color,border-color,box-shadow] duration-[var(--motion-fast)] ease-[var(--ease-out)] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-45 motion-reduce:active:scale-100",
    variants[variant],
    sizes[size],
    className,
  );
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "default", type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={buttonStyles({ variant, size, className })}
      {...props}
    />
  ),
);
Button.displayName = "Button";
