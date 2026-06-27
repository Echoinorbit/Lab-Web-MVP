"use client";

import { useQuery } from "@tanstack/react-query";

import type { NotificationPageData } from "../types";

export const NOTIFICATIONS_QUERY_KEY = ["notifications"] as const;

export function useNotifications(page: number, initialData?: NotificationPageData) {
  return useQuery({
    queryKey: [...NOTIFICATIONS_QUERY_KEY, page],
    queryFn: async () => {
      const response = await fetch(`/api/notifications?page=${page}`, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to load notifications.");
      return response.json() as Promise<NotificationPageData>;
    },
    initialData,
    refetchInterval: 30_000,
  });
}
