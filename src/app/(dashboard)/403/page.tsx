import { HudState } from "@/shared/components/endfield/hud/hud-state";

export default function ForbiddenPage() {
  return <HudState code="403" label="ACCESS DENIED" title="你没有权限访问此区域" message="权限仍由角色与有效 Tag 在服务器实时计算。返回总览可继续处理可访问事项。" actionHref="/dashboard" actionLabel="返回总览" />;
}
