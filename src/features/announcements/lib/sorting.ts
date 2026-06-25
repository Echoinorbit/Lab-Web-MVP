import type { Prisma } from "@prisma/client";

export const ANNOUNCEMENT_ORDER_BY = [
  { isPinned: "desc" },
  { isUrgent: "desc" },
  { createdAt: "desc" },
] satisfies Prisma.AnnouncementOrderByWithRelationInput[];

export type AnnouncementSortSnapshot = {
  isPinned: boolean;
  isUrgent: boolean;
  createdAt: Date | string;
};

function boolWeight(value: boolean) {
  return value ? 1 : 0;
}

function timeValue(value: Date | string) {
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

export function compareAnnouncementsForDisplay(a: AnnouncementSortSnapshot, b: AnnouncementSortSnapshot) {
  return (
    boolWeight(b.isPinned) - boolWeight(a.isPinned) ||
    boolWeight(b.isUrgent) - boolWeight(a.isUrgent) ||
    timeValue(b.createdAt) - timeValue(a.createdAt)
  );
}
