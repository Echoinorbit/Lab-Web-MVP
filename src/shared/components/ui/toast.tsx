"use client";

import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/lib/utils";

export type ToastVariant = "success" | "error" | "info";

export type ToastInput = {
  title: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
};

type ToastRecord = ToastInput & { id: number };

type ToastContextValue = {
  toast: (input: ToastInput) => number;
  dismiss: (id: number) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const variantStyles: Record<ToastVariant, string> = {
  success: "border-success/30",
  error: "border-destructive/35",
  info: "border-primary/25",
};

const variantIcons = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
} satisfies Record<ToastVariant, typeof Info>;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((item) => item.id !== id));
  }, []);

  const toast = useCallback((input: ToastInput) => {
    const id = nextId.current++;
    setToasts((current) => [...current.slice(-3), { ...input, id }]);
    return id;
  }, []);

  const value = useMemo(() => ({ toast, dismiss }), [dismiss, toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-3 bottom-4 z-[100] flex flex-col items-center gap-2 sm:inset-x-auto sm:bottom-6 sm:right-6 sm:w-[min(390px,calc(100vw-3rem))] sm:items-stretch"
        aria-label="操作反馈"
        aria-live="polite"
      >
        {toasts.map((item) => (
          <ToastItem key={item.id} item={item} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ item, onDismiss }: { item: ToastRecord; onDismiss: (id: number) => void }) {
  const variant = item.variant ?? "info";
  const Icon = variantIcons[variant];
  const [closing, setClosing] = useState(false);
  const closeTimeoutRef = useRef<number | null>(null);

  const close = useCallback(() => {
    if (closeTimeoutRef.current !== null) return;
    setClosing(true);
    closeTimeoutRef.current = window.setTimeout(() => onDismiss(item.id), 160);
  }, [item.id, onDismiss]);

  useEffect(() => {
    const timeout = window.setTimeout(close, item.duration ?? 4_500);
    return () => {
      window.clearTimeout(timeout);
      if (closeTimeoutRef.current !== null) window.clearTimeout(closeTimeoutRef.current);
    };
  }, [close, item.duration]);

  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      data-state={closing ? "closed" : "open"}
      className={cn(
        "ui-toast pointer-events-auto flex w-full max-w-[390px] items-start gap-3 rounded-xl border bg-surface-raised p-4 text-sm shadow-[var(--shadow-popover)]",
        variantStyles[variant],
      )}
    >
      <Icon
        className={cn(
          "mt-0.5 h-[18px] w-[18px] shrink-0",
          variant === "success" && "text-success",
          variant === "error" && "text-destructive",
          variant === "info" && "text-primary",
        )}
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1">
        <div className="font-semibold leading-5">{item.title}</div>
        {item.description ? <p className="mt-0.5 leading-5 text-muted-foreground">{item.description}</p> : null}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="-mr-2 -mt-2 h-9 w-9 shrink-0"
        onClick={close}
        aria-label="关闭提示"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </Button>
    </div>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used within ToastProvider.");
  return context;
}
