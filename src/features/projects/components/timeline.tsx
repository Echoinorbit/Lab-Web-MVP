import { NodeCard, type TimelineNode } from "./node-card";

function flatten(nodes: readonly TimelineNode[], depth = 0): Array<TimelineNode & { depth: number }> {
  return nodes.flatMap((node) => [{ ...node, depth }, ...flatten(node.children ?? [], depth + 1)]);
}

const depthClasses = ["pl-0", "pl-5", "pl-10", "pl-14", "pl-16"] as const;

export function ProjectTimeline({
  nodes,
  viewerId,
  canManageNodeActions,
}: {
  nodes: readonly TimelineNode[];
  viewerId: string;
  canManageNodeActions: boolean;
}) {
  const rows = flatten(nodes);
  return (
    <div className="space-y-3">
      {rows.map((node) => (
        <div key={node.id} className={depthClasses[Math.min(node.depth, depthClasses.length - 1)]}>
          <NodeCard node={node} viewerId={viewerId} canManageNodeActions={canManageNodeActions} />
        </div>
      ))}
    </div>
  );
}
