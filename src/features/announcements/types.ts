export type AnnouncementSummary = {
  id: string;
  title: string;
  content: string;
  authorName: string;
  createdAt: string;
  updatedAt?: string | null;
  isPinned: boolean;
  isUrgent: boolean;
};
