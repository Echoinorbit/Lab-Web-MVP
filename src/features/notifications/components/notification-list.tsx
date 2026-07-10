"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCheck, Mail } from "lucide-react";
import { useRouter } from "next/navigation";
import type { KeyboardEvent } from "react";

import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { cn } from "@/shared/lib/utils";

import { NOTIFICATIONS_QUERY_KEY, useNotifications } from "../hooks/use-notifications";
import { getNotificationTypeLabel } from "../lib/display";
import type { NotificationPageData, NotificationRow } from "../types";

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

  function markRead(id: string) {
    mutation.mutate({ id, read: true });
  }

  function markAllRead() {
    mutation.mutate({ read: true });
  }

  function markUnread(id: string) {
    mutation.mutate({ id, read: false });
  }

  function handleCardKeyDown(event: KeyboardEvent<HTMLDivElement>, notification: NotificationRow) {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    if (!notification.isRead) markRead(notification.id);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-[-0.025em]">通知</h1>
        <Button type="button" variant="secondary" disabled={unreadCount === 0 || mutation.isPending} onClick={markAllRead}>
          <CheckCheck className="h-4 w-4" />
          全部已读
        </Button>
      </div>
      {rows.length > 0 ? (
        <div className="space-y-2">
          {rows.map((notification) => (
            <Card
              key={notification.id}
              data-notification-row
              role="button"
              tabIndex={0}
              onClick={() => {
                if (!notification.isRead) markRead(notification.id);
              }}
              onKeyDown={(event) => handleCardKeyDown(event, notification)}
              className={cn(
                "cursor-pointer transition-[border-color,background-color,box-shadow,opacity] duration-[var(--motion-base)] ease-[var(--ease-fluid)] hover:border-foreground/20 hover:bg-muted/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                notification.isRead ? "opacity-75" : "border-primary/50 bg-primary/5",
              )}
            >
              <CardHeader className="flex flex-row items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="rounded-full bg-muted px-2 py-0.5 text-foreground">
                      {getNotificationTypeLabel(notification.type, notification.relatedType)}
                    </span>
                    <span>{notification.isRead ? "已读" : "未读"}</span>
                    {notification.senderName ? <span>来自 {notification.senderName}</span> : null}
                  </div>
                  <CardTitle className="text-sm">{notification.title}</CardTitle>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-8 px-2"
                  disabled={!notification.isRead || mutation.isPending}
                  onClick={(event) => {
                    event.stopPropagation();
                    markUnread(notification.id);
                  }}
                >
                  <Mail className="h-4 w-4" />
                  标为未读
                </Button>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {notification.content ? <p>{notification.content}</p> : null}
                <div className="mt-2 text-xs">{notification.createdAt}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="text-sm text-muted-foreground">暂无通知</CardContent>
        </Card>
      )}
    </div>
  );
}
