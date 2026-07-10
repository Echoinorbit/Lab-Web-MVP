"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BellOff, Check, CheckCheck, Mail } from "lucide-react";
import { useRouter } from "next/navigation";

import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { PageHeader } from "@/shared/components/ui/page-header";
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
    <div className="space-y-8">
      <PageHeader
        title="通知"
        description={unreadCount > 0 ? `还有 ${unreadCount} 条未读通知。处理后可随时重新标为未读。` : "所有通知均已阅读。新动态会按时间出现在这里。"}
        actions={(
          <Button type="button" variant="secondary" disabled={unreadCount === 0 || mutation.isPending} onClick={() => mutation.mutate({ read: true })}>
            <CheckCheck className="h-4 w-4" aria-hidden="true" />
            全部已读
          </Button>
        )}
      />

      {rows.length > 0 ? (
        <div className="overflow-hidden rounded-2xl border border-border/90 bg-card">
          {rows.map((notification) => (
            <article
              key={notification.id}
              data-notification-row
              className={cn(
                "grid gap-4 border-b border-border/75 px-5 py-5 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start sm:px-6",
                notification.isRead ? "bg-card" : "bg-primary/[0.045]",
              )}
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Badge className={notification.isRead ? undefined : "border-primary/25 bg-primary/10 text-primary"}>
                    {getNotificationTypeLabel(notification.type, notification.relatedType)}
                  </Badge>
                  <span className="inline-flex items-center gap-1">
                    {notification.isRead ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />}
                    {notification.isRead ? "已读" : "未读"}
                  </span>
                  {notification.senderName ? <span>来自 {notification.senderName}</span> : null}
                  <span>{notification.createdAt}</span>
                </div>
                <h2 className="mt-3 text-[16px] font-semibold leading-6 tracking-[-0.018em]">{notification.title}</h2>
                {notification.content ? <p className="mt-1.5 max-w-3xl text-sm leading-6 text-muted-foreground">{notification.content}</p> : null}
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
        <EmptyState
          icon={<BellOff className="h-5 w-5" aria-hidden="true" />}
          title="暂无通知"
          description="项目、公告和治理动态到来后，会按时间出现在这里。"
        />
      )}

      {mutation.isError ? <p role="alert" className="text-sm text-destructive">通知状态更新失败，请稍后重试。</p> : null}
      {query.isFetching ? <p role="status" className="text-sm text-muted-foreground">正在同步通知…</p> : null}
    </div>
  );
}
