export function buildPublicPostWhere() {
  return { status: "PUBLISHED" as const, deletedAt: null };
}

export function buildVisiblePostWhere(userId: string, postId: string) {
  return {
    id: postId,
    deletedAt: null,
    OR: [{ status: "PUBLISHED" as const }, { status: "DRAFT" as const, authorId: userId }],
  };
}

export function buildMyDraftsWhere(userId: string) {
  return { authorId: userId, status: "DRAFT" as const, deletedAt: null };
}

export function shouldAutosaveDraft(input: { title: string; content: string }) {
  return input.title.trim().length > 0 || input.content.trim().length > 0;
}
