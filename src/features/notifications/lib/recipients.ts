export function shouldNotifyRecipient(actorId: string, recipientId: string) {
  return actorId !== recipientId;
}

export function uniqueNotificationRecipientIds(ids: readonly string[], actorId?: string) {
  return [...new Set(ids)].filter((id) => !actorId || shouldNotifyRecipient(actorId, id));
}
