"use client";

import { useActionState, useState } from "react";

import { MarkdownEditor } from "@/shared/components/markdown-editor";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Select } from "@/shared/components/ui/select";
import { StatusNotice } from "@/shared/components/ui/status-notice";

import { updateProjectNodeFormAction, type UpdateProjectNodeState } from "../actions/edit-node";
import type { ProjectCanvasNodeType } from "../lib/node-canvas";
import { PROJECT_NODE_ROOT_PARENT_VALUE } from "../lib/node-parent-selection";

const initialState: UpdateProjectNodeState = { ok: false, message: null };

export function ProjectNodeEditForm({
  node,
  parentOptions,
}: {
  node: {
    id: string;
    title: string;
    description?: string | null;
    nodeType: ProjectCanvasNodeType;
    parentId: string | null;
  };
  parentOptions: readonly { id: string; title: string }[];
}) {
  const [description, setDescription] = useState(node.description ?? "");
  const [state, formAction, isPending] = useActionState(updateProjectNodeFormAction, initialState);

  return (
    <Card>
      <CardHeader>
        <CardTitle>编辑节点</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="grid gap-3" aria-busy={isPending}>
          <input type="hidden" name="nodeId" value={node.id} />
          <div className="space-y-2">
            <Label htmlFor="node-title">标题</Label>
            <Input id="node-title" name="title" defaultValue={node.title} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="node-type">类型</Label>
            <Select
              id="node-type"
              name="nodeType"
              className="w-full"
              defaultValue={node.nodeType}
            >
              <option value="MILESTONE">里程碑</option>
              <option value="UPDATE">更新</option>
              <option value="DECISION">决策</option>
              <option value="ISSUE">问题</option>
              <option value="RESOURCE">资源</option>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="parent-node">父节点</Label>
            <Select
              id="parent-node"
              name="parentId"
              className="w-full"
              defaultValue={node.parentId ?? PROJECT_NODE_ROOT_PARENT_VALUE}
            >
              <option value={PROJECT_NODE_ROOT_PARENT_VALUE}>根节点</option>
              {parentOptions.map((parent) => (
                <option key={parent.id} value={parent.id}>{parent.title}</option>
              ))}
            </Select>
          </div>
          <MarkdownEditor name="description" value={description} onChange={setDescription} placeholder="节点说明" />
          {state.message ? <StatusNotice variant={state.ok ? "success" : "error"}>{state.message}</StatusNotice> : null}
          <Button type="submit" className="w-fit" disabled={isPending}>
            {isPending ? "正在保存…" : "保存节点"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
