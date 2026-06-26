export type CommentRow = {
  id: string;
  content: string;
  authorId: string;
  authorName: string;
  createdAt: string;
  isDeleted?: boolean;
  children?: CommentRow[];
};

