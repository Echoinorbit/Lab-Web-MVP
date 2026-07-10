"use client";

import { useActionState, useState } from "react";

import { MarkdownEditor } from "@/shared/components/markdown-editor";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";

import { updateProjectNodeFormAction, type UpdateProjectNodeState } from "../actions/edit-node";
import type { ProjectCanvasNodeType } from "../lib/node-canvas";

const initialState: UpdateProjectNodeState = { ok: false, message: null };

export function ProjectNodeEditForm({
  node,
}: {
  node: {
    id: string;
    title: string;
    description?: string | null;
    nodeType: ProjectCanvasNodeType;
  };
}) {
  const [description, setDescription] = useState(node.description ?? "");
  const [state, formAction, isPending] = useActionState(updateProjectNodeFormAction, initialState);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">编辑节点</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="grid gap-3">
          <input type="hidden" name="nodeId" value={node.id} />
          <div className="space-y-2">
            <Label htmlFor="node-title">标题</Label>
            <Input id="node-title" name="title" defaultValue={node.title} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="node-type">类型</Label>
            <select
              id="node-type"
              name="nodeType"
              className="h-10 rounded-lg border border-input bg-card px-3 text-sm outline-none transition-[border-color,box-shadow] duration-200 hover:border-foreground/20 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20"
              defaultValue={node.nodeType}
            >
              <option value="MILESTONE">里程碑</option>
              <option value="UPDATE">更新</option>
              <option value="DECISION">决策</option>
              <option value="ISSUE">问题</option>
              <option value="RESOURCE">资源</option>
            </select>
          </div>
          <MarkdownEditor name="description" value={description} onChange={setDescription} placeholder="节点说明" />
          {state.message ? <p className="text-sm text-muted-foreground">{state.message}</p> : null}
          <Button type="submit" className="w-fit" disabled={isPending}>
            {isPending ? "保存中" : "保存节点"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
