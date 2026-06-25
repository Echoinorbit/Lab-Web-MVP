"use client";

import {
  Background,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  type NodeProps,
  type NodeTypes,
} from "@xyflow/react";
import { CircleAlert, Flag, GitCommitHorizontal, Lightbulb, Paperclip } from "lucide-react";
import { useEffect, useMemo } from "react";

import { Badge } from "@/shared/components/ui/badge";
import { Card, CardContent } from "@/shared/components/ui/card";

import { ProjectNodeActions } from "./project-node-actions";
import {
  mapProjectNodesToCanvas,
  type ProjectCanvasSourceNode,
  type ProjectFlowNode,
} from "../lib/node-canvas";
import { resolveAuthorColor } from "../lib/author-color";

const nodeMeta = {
  MILESTONE: { label: "里程碑", icon: Flag, className: "bg-primary text-primary-foreground" },
  UPDATE: { label: "更新", icon: GitCommitHorizontal, className: "bg-muted" },
  DECISION: { label: "决策", icon: Lightbulb, className: "bg-secondary" },
  ISSUE: { label: "问题", icon: CircleAlert, className: "bg-destructive text-destructive-foreground" },
  RESOURCE: { label: "资源", icon: Paperclip, className: "bg-muted" },
} as const;

function ProjectCanvasCard({ id, data }: NodeProps<ProjectFlowNode>) {
  const meta = nodeMeta[data.nodeType];
  const Icon = meta.icon;
  const accentColor = resolveAuthorColor({ authorId: data.authorId, colorHex: data.colorHex });
  const canManageNode = data.viewerId === data.authorId;
  return (
    <div
      className="relative w-[260px] rounded-md border-2 bg-card text-card-foreground shadow-sm"
      style={{ borderColor: accentColor }}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!h-2 !w-2 !border !border-card !bg-muted-foreground"
      />
      <div className="space-y-2 border-b p-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className={meta.className}>
            <Icon className="mr-1 h-3 w-3" />
            {meta.label}
          </Badge>
          <span
            className="h-2.5 w-2.5 rounded-full border border-card"
            style={{ backgroundColor: accentColor }}
            aria-hidden="true"
          />
          <span className="text-xs text-muted-foreground">
            {data.authorName} · {data.createdAt}
          </span>
        </div>
        <div className="text-sm font-semibold leading-5">{data.title}</div>
      </div>
      {data.description ? <div className="p-3 text-sm leading-6 text-muted-foreground">{data.description}</div> : null}
      {canManageNode ? (
        <div className="border-t p-3">
          <ProjectNodeActions projectId={data.projectId} nodeId={id} />
        </div>
      ) : null}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!h-2 !w-2 !border !border-card !bg-muted-foreground"
      />
    </div>
  );
}

const nodeTypes = {
  projectNode: ProjectCanvasCard,
} satisfies NodeTypes;

export function NodeCanvas({
  nodes,
  viewerId,
  canManageNodeActions,
}: {
  nodes: readonly ProjectCanvasSourceNode[];
  viewerId: string;
  canManageNodeActions: boolean;
}) {
  const canvas = useMemo(() => {
    const mapped = mapProjectNodesToCanvas(nodes);
    return {
      ...mapped,
      nodes: mapped.nodes.map((node) => ({
        ...node,
        data: { ...node.data, viewerId: canManageNodeActions ? viewerId : undefined },
      })),
    };
  }, [nodes, viewerId]);
  const [flowNodes, setFlowNodes, onNodesChange] = useNodesState<ProjectFlowNode>(canvas.nodes);
  const [flowEdges, setFlowEdges, onEdgesChange] = useEdgesState(canvas.edges);

  useEffect(() => {
    setFlowNodes(canvas.nodes);
    setFlowEdges(canvas.edges);
  }, [canvas.edges, canvas.nodes, setFlowEdges, setFlowNodes]);

  if (nodes.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">暂无项目节点。</CardContent>
      </Card>
    );
  }

  return (
    <div className="h-[560px] min-h-[420px] overflow-hidden rounded-md border bg-card">
      <ReactFlowProvider>
        <ReactFlow
          nodes={flowNodes}
          edges={flowEdges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          fitView
          fitViewOptions={{ padding: 0.18 }}
          minZoom={0.2}
          maxZoom={1.8}
          panOnDrag
          zoomOnScroll
          zoomOnPinch
          className="bg-background"
        >
          <Background color="hsl(var(--border))" gap={24} size={1} />
          <MiniMap
            pannable
            zoomable
            nodeStrokeWidth={3}
            nodeColor={(node) =>
              resolveAuthorColor({
                authorId: String(node.data.authorId),
                colorHex: typeof node.data.colorHex === "string" ? node.data.colorHex : null,
              })
            }
            className="!bg-card"
          />
          <Controls className="!border !border-border !bg-card !shadow-sm" />
        </ReactFlow>
      </ReactFlowProvider>
    </div>
  );
}
