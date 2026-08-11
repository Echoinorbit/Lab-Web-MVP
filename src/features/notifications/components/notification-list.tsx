"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, CheckCheck, Mail } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/lib/utils";

import { NOTIFICATIONS_QUERY_KEY, useNotifications } from "../hooks/use-notifications";
import { getNotificationTypeLabel } from "../lib/display";
import type { NotificationPageData } from "../types";

async function updateNotificationReadState(input: { id?: string; read?: boolean }) {
  const response = await fetch("/api/notifications", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error("通知状态更新失败。");
}

export function NotificationList({ pageData }: { pageData: NotificationPageData }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const query = useNotifications(pageData.page, pageData);
  const data = query.data ?? pageData;
  const rows = data.items;
  const unreadCount = data.unreadCount;
  const mutation = useMutation({
    mutationFn: updateNotificationReadState,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
      router.refresh();
    },
  });

  function updateReadState(id: string, read: boolean) {
    mutation.mutate({ id, read });
  }

  return (
    <section data-section="notifications" className="border-y border-border bg-background">
      <header className="flex min-h-[16rem] items-end justify-between gap-8 bg-foreground px-8 py-8 text-background portrait:min-h-[20rem] portrait:flex-col portrait:items-start portrait:justify-end portrait:px-6">
        <div>
          <p className="font-mono text-[.875rem] uppercase tracking-[.12em] text-background/60">// notification log</p>
          <h1 className="mt-4 font-bold text-[3rem] leading-none">通知</h1>
          <p className="mt-4 max-w-[36rem] text-[1.125rem] leading-7 text-background/72">{unreadCount > 0 ? `还有 ${unreadCount} 条未读通知。处理后可随时重新标为未读。` : "所有通知均已阅读。新动态会按时间出现在这里。"}</p>
        </div>
        <Button type="button" variant="secondary" disabled={unreadCount === 0 || mutation.isPending} onClick={() => mutation.mutate({ read: true })}>
          <CheckCheck className="h-4 w-4" aria-hidden="true" />
          全部已读
        </Button>
      </header>

      {rows.length > 0 ? (
        <div className="border-t border-border bg-card">
          {rows.map((notification) => (
            <article
              key={notification.id}
              data-notification-row
              className={cn(
                "relative grid gap-5 border-b border-border px-8 py-7 transition-colors duration-[var(--motion-fast)] ease-[var(--ease-out)] last:border-b-0 landscape:grid-cols-[minmax(0,1fr)_auto] landscape:items-start portrait:px-6",
                notification.isRead ? "bg-card" : "bg-surface-raised before:absolute before:inset-y-0 before:left-0 before:w-[2px] before:bg-brand-yellow",
              )}
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-[.875rem] uppercase tracking-[.05em] text-muted-foreground">
                  <span className={notification.isRead ? undefined : "text-foreground"}>// {getNotificationTypeLabel(notification.type, notification.relatedType)}</span>
                  <span>{notification.isRead ? "已读" : "未读"}</span>
                  {notification.senderName ? <span>来自 {notification.senderName}</span> : null}
                  <time>{notification.createdAt}</time>
                </div>
                <h2 className="mt-4 text-[1.375rem] font-medium leading-7">{notification.title}</h2>
                {notification.content ? <p className="mt-2 max-w-[52rem] text-[1rem] leading-7 text-muted-foreground">{notification.content}</p> : null}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="small"
                disabled={mutation.isPending}
                onClick={() => updateReadState(notification.id, !notification.isRead)}
              >
                {notification.isRead ? <Mail className="h-4 w-4" aria-hidden="true" /> : <Check className="h-4 w-4" aria-hidden="true" />}
                {notification.isRead ? "标为未读" : "标为已读"}
              </Button>
            </article>
          ))}
        </div>
      ) : (
        <div className="border-t border-dashed border-border px-8 py-20 text-center font-mono text-[.875rem] uppercase tracking-[.05em] text-muted-foreground">// 暂无通知</div>
      )}

      {mutation.isError ? <p role="alert" className="border-l-[2px] border-destructive px-8 py-4 text-[1rem] text-destructive">// 通知状态更新失败，请稍后重试。</p> : null}
      {query.isFetching ? <p role="status" className="px-8 py-4 font-mono text-[.875rem] uppercase tracking-[.05em] text-muted-foreground">// 正在同步通知…</p> : null}
    </section>
  );
}
