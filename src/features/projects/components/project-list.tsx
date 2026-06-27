import Link from "next/link";

import { Badge } from "@/shared/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";

import { summarizeProjectDescription } from "../lib/preview";

export type ProjectSummary = {
  id: string;
  name: string;
  status: string;
  memberCount: number;
  nodeCount: number;
  description?: string | null;
  canPreview?: boolean;
  deletedAt?: string | null;
};

export function ProjectList({ projects }: { projects: readonly ProjectSummary[] }) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {projects.map((project) => (
        <Link key={project.id} href={`/projects/${project.id}`} className="group relative">
          <Card className="h-full transition hover:border-primary">
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-sm">{project.name}</CardTitle>
                <Badge>{project.deletedAt ? "已软删除" : project.status}</Badge>
              </div>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-xs text-muted-foreground">成员</div>
                <div className="font-semibold">{project.memberCount}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">节点</div>
                <div className="font-semibold">{project.nodeCount}</div>
              </div>
            </CardContent>
          </Card>
          {project.canPreview ? (
            <div className="absolute left-0 top-full z-20 mt-2 hidden w-72 rounded-md border bg-card p-3 text-sm shadow-md group-hover:block">
              <div className="font-medium">{project.name}</div>
              <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                <div>
                  <div className="text-muted-foreground">状态</div>
                  <div className="font-medium">{project.status}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">成员</div>
                  <div className="font-medium">{project.memberCount}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">节点</div>
                  <div className="font-medium">{project.nodeCount}</div>
                </div>
              </div>
              <p className="mt-3 leading-6 text-muted-foreground">{summarizeProjectDescription(project.description)}</p>
            </div>
          ) : null}
        </Link>
      ))}
    </div>
  );
}
