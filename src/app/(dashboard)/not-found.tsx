import { HudState } from "@/shared/components/endfield/hud/hud-state";

export default function DashboardNotFound() {
  return <HudState code="404" label="ROUTE NOT FOUND" title="这个页面不在工作区中" message="记录可能已被删除、归档，或当前链接已经失效。返回总览可继续处理可访问事项。" actionHref="/dashboard" actionLabel="返回总览" />;
}
