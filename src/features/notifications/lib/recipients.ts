export function shouldNotifyRecipient(actorId: string, recipientId: string) {
  return actorId !== recipientId;
}

export function uniqueNotificationRecipientIds(ids: readonly string[], actorId?: string) {
  return [...new Set(ids)].filter((id) => !actorId || shouldNotifyRecipient(actorId, id));
}

export function mergeAdminNotificationRecipientIds({
  recipientIds,
  adminIds,
  actorId,
}: {
  recipientIds: readonly string[];
  adminIds: readonly string[];
  actorId: string;
}) {
  return uniqueNotificationRecipientIds([...recipientIds, ...adminIds], actorId);
}

export type AdminNotificationRecipientLookup = {
  user: {
    findMany(args: {
      where: { role: "ADMIN"; status: "ACTIVE" };
      select: { id: true };
    }): PromiseLike<Array<{ id: string }>>;
  };
};

export async function includeActiveAdminsInNotificationRecipients(
  client: AdminNotificationRecipientLookup,
  {
    recipientIds,
    actorId,
  }: {
    recipientIds: readonly string[];
    actorId: string;
  },
) {
  const admins = await client.user.findMany({
    where: { role: "ADMIN", status: "ACTIVE" },
    select: { id: true },
  });
  return mergeAdminNotificationRecipientIds({
    recipientIds,
    adminIds: admins.map((admin) => admin.id),
    actorId,
  });
}
