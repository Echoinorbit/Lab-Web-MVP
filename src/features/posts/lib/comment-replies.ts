export type ReplyParentSnapshot = {
  postId: string;
  parentId: string | null;
  deletedAt: Date | null;
};

export function buildReplyParentWhere(postId: string, parentId: string) {
  return { id: parentId, postId, deletedAt: null };
}

export function canReplyToCommentSnapshot(comment: ReplyParentSnapshot, postId: string) {
  return comment.postId === postId && comment.deletedAt === null;
}
