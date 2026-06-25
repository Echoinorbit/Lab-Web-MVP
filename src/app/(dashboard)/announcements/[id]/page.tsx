import { AnnouncementCard } from "@/features/announcements";

export default async function AnnouncementDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <AnnouncementCard
      announcement={{
        id,
        title: `公告 ${id}`,
        content: "公告详情骨架。真实查询应包含 `deletedAt: null` 过滤。",
        authorName: "李教授",
        createdAt: "2026-06-22",
        isPinned: false,
        isUrgent: false,
      }}
    />
  );
}
