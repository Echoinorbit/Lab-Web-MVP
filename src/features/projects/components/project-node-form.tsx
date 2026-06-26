"use client";

import { useActionState, useState } from "react";

import { MarkdownEditor } from "@/shared/components/markdown-editor";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";

import { createProjectNodeFormAction, type ProjectNodeState } from "../actions/create-node";
import { PROJECT_NODE_ROOT_PARENT_VALUE } from "../lib/node-parent-selection";

export type ProjectNodeOption = {
  id: string;
  title: string;
};

const initialState: ProjectNodeState = { ok: false, message: null };

export function ProjectNodeForm({
  projectId,
  parentOptions,
}: {
  projectId: string;
  parentOptions: readonly ProjectNodeOption[];
}) {
  const [description, setDescription] = useState("");
  const [state, formAction, isPending] = useActionState(createProjectNodeFormAction, initialState);
  const message = state.message;
  const defaultParentId = parentOptions[0]?.id ?? PROJECT_NODE_ROOT_PARENT_VALUE;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">新增节点</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="grid gap-3">
          <input type="hidden" name="projectId" value={projectId} />
          <div className="space-y-2">
            <Label htmlFor="node-title">标题</Label>
            <Input id="node-title" name="title" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="node-type">类型</Label>
            <select id="node-type" name="nodeType" className="h-9 rounded-md border bg-background px-3 text-sm">
              <option value="MILESTONE">里程碑</option>
              <option value="UPDATE">更新</option>
              <option value="DECISION">决策</option>
              <option value="ISSUE">问题</option>
              <option value="RESOURCE">资源</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="parent-node">父节点</Label>
            <select
              id="parent-node"
              name="parentId"
              className="h-9 rounded-md border bg-background px-3 text-sm"
              defaultValue={defaultParentId}
            >
              <option value={PROJECT_NODE_ROOT_PARENT_VALUE}>根节点</option>
              {parentOptions.map((node) => (
                <option key={node.id} value={node.id}>
                  {node.title}
                </option>
              ))}
            </select>
          </div>
          <MarkdownEditor name="description" value={description} onChange={setDescription} placeholder="节点说明" />
          {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
          <Button type="submit" className="w-fit" disabled={isPending}>
            {isPending ? "创建中" : "创建节点"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
