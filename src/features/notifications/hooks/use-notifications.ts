"use client";

import { useQuery } from "@tanstack/react-query";

import type { NotificationRow } from "../types";

export const NOTIFICATIONS_QUERY_KEY = ["notifications"] as const;

export function useNotifications(initialData?: readonly NotificationRow[]) {
  return useQuery({
    queryKey: NOTIFICATIONS_QUERY_KEY,
    queryFn: async () => {
      const response = await fetch("/api/notifications", { credentials: "include" });
      if (!response.ok) throw new Error("Failed to load notifications.");
      return response.json() as Promise<NotificationRow[]>;
    },
    initialData: initialData ? [...initialData] : undefined,
    refetchInterval: 30_000,
  });
}
