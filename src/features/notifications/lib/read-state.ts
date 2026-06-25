import { z } from "zod";

export const notificationReadStateSchema = z
  .object({
    id: z.string().min(1).optional(),
    read: z.boolean().optional(),
  })
  .strict()
  .refine((data) => Boolean(data.id) || data.read === true, {
    message: "通知状态更新必须指定通知 ID 或显式标记全部已读。",
    path: ["id"],
  })
  .refine((data) => data.read !== false || Boolean(data.id), {
    message: "标为未读必须指定通知 ID。",
    path: ["id"],
  });

export type NotificationReadStateInput = z.infer<typeof notificationReadStateSchema>;

export function buildNotificationReadUpdate(
  userId: string,
  input: NotificationReadStateInput,
  now = new Date(),
) {
  const read = input.read ?? true;
  return {
    where: {
      userId,
      ...(input.id ? { id: input.id } : { isRead: false }),
    },
    data: {
      isRead: read,
      readAt: read ? now : null,
    },
  };
}
