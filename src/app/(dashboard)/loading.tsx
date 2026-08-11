import { HudState } from "@/shared/components/endfield/hud/hud-state";

export default function DashboardLoading() {
  return <HudState code="00" label="UPDATING" title="正在载入工作区" message="正在同步可访问的数据与权限状态。" loading />;
}
