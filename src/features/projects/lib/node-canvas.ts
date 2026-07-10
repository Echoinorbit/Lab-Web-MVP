export type ProjectCanvasNodeType = "MILESTONE" | "UPDATE" | "DECISION" | "ISSUE" | "RESOURCE";

export type ProjectCanvasSourceNode = {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  nodeType: ProjectCanvasNodeType;
  parentId: string | null;
  authorId: string;
  authorName: string;
  createdAt: string;
  colorHex?: string | null;
};
