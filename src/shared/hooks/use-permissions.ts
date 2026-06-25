"use client";

import { useMemo } from "react";

import { useAuth } from "./use-auth";

export function usePermissions() {
  const { data: session } = useAuth();
  return useMemo(() => {
    const permissions = new Set(session?.user.permissions ?? []);

    return {
      hasPermission: (permission: string) => permissions.has(permission),
      hasTag: (tagName: string, projectId?: string) =>
        session?.user.tags.some((tag) => {
          const nameMatches = tag.name === tagName || (projectId ? tag.name === `${tagName}:${projectId}` : false);
          return nameMatches && (!projectId || tag.projectId === projectId);
        }) ??
        false,
    };
  }, [session?.user.permissions, session?.user.tags]);
}
