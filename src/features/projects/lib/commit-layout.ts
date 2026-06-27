export const COMMIT_LAYOUT_STORAGE_KEY = "lab-platform:project-commit-layout:v1";
export const COMMIT_AUTHOR_MIN_WIDTH = 120;
export const COMMIT_AUTHOR_MAX_WIDTH = 280;
export const COMMIT_INSPECTOR_MIN_WIDTH = 240;
export const COMMIT_INSPECTOR_MAX_WIDTH = 520;
export const COMMIT_GRAPH_MIN_WIDTH = 360;
export const COMMIT_RESIZER_TOTAL_WIDTH = 16;

export type CommitPanelWidths = { author: number; inspector: number };

export const DEFAULT_COMMIT_PANEL_WIDTHS: CommitPanelWidths = { author: 156, inspector: 320 };

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

export function clampCommitPanelWidths(
  widths: CommitPanelWidths,
  containerWidth = Number.POSITIVE_INFINITY,
): CommitPanelWidths {
  const author = clamp(widths.author, COMMIT_AUTHOR_MIN_WIDTH, COMMIT_AUTHOR_MAX_WIDTH);
  const inspectorMaxByContainer = containerWidth - author - COMMIT_GRAPH_MIN_WIDTH - COMMIT_RESIZER_TOTAL_WIDTH;
  const inspector = clamp(
    widths.inspector,
    COMMIT_INSPECTOR_MIN_WIDTH,
    Math.min(COMMIT_INSPECTOR_MAX_WIDTH, inspectorMaxByContainer),
  );
  const authorMaxByContainer = containerWidth - inspector - COMMIT_GRAPH_MIN_WIDTH - COMMIT_RESIZER_TOTAL_WIDTH;
  return {
    author: clamp(author, COMMIT_AUTHOR_MIN_WIDTH, Math.min(COMMIT_AUTHOR_MAX_WIDTH, authorMaxByContainer)),
    inspector,
  };
}

export function parseCommitPanelWidths(value: string | null): CommitPanelWidths {
  if (!value) return DEFAULT_COMMIT_PANEL_WIDTHS;
  try {
    const parsed = JSON.parse(value) as Partial<CommitPanelWidths>;
    if (!Number.isFinite(parsed.author) || !Number.isFinite(parsed.inspector)) return DEFAULT_COMMIT_PANEL_WIDTHS;
    return clampCommitPanelWidths({ author: Number(parsed.author), inspector: Number(parsed.inspector) });
  } catch {
    return DEFAULT_COMMIT_PANEL_WIDTHS;
  }
}
