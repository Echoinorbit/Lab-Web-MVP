"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";

import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/lib/utils";

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
  dismissible = true,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  className?: string;
  dismissible?: boolean;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      window.requestAnimationFrame(() => {
        dialog.querySelector<HTMLElement>("[data-autofocus]")?.focus();
      });
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      className={cn(
        "ui-dialog m-auto max-h-[min(84vh,760px)] w-[min(92vw,560px)] overflow-y-auto rounded-xl border border-border bg-surface-raised p-0 text-foreground shadow-[var(--shadow-popover)]",
        className,
      )}
      onCancel={(event) => {
        event.preventDefault();
        if (dismissible) onOpenChange(false);
      }}
      onClose={() => onOpenChange(false)}
      onClick={(event) => {
        if (dismissible && event.target === event.currentTarget) onOpenChange(false);
      }}
    >
      <div className="flex items-start gap-4 border-b border-border/75 px-5 py-5 sm:px-6">
        <div className="min-w-0 flex-1">
          <h2 id={titleId} className="text-xl font-semibold tracking-[-0.025em]">{title}</h2>
          {description ? <div id={descriptionId} className="mt-1.5 text-sm leading-6 text-muted-foreground">{description}</div> : null}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="-mr-2 -mt-2 shrink-0"
          onClick={() => onOpenChange(false)}
          disabled={!dismissible}
          aria-label="关闭对话框"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
      {children ? <div className="px-5 py-5 sm:px-6">{children}</div> : null}
      {footer ? <div className="flex flex-col-reverse gap-2 border-t border-border/75 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">{footer}</div> : null}
    </dialog>
  );
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  confirmLabel = "确认",
  cancelLabel = "取消",
  destructive = false,
  pending = false,
  confirmDisabled = false,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  pending?: boolean;
  confirmDisabled?: boolean;
  onConfirm: () => void;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!pending || nextOpen) onOpenChange(nextOpen);
      }}
      title={title}
      description={description}
      dismissible={!pending}
      footer={(
        <>
          <Button
            type="button"
            variant="secondary"
            data-autofocus={destructive ? true : undefined}
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={destructive ? "destructive" : "primary"}
            data-autofocus={!destructive ? true : undefined}
            onClick={onConfirm}
            disabled={pending || confirmDisabled}
          >
            {pending ? "正在处理…" : confirmLabel}
          </Button>
        </>
      )}
    >
      {children}
    </Dialog>
  );
}
