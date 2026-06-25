import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";

export function ImportResult({
  created,
  updated,
  unchanged,
  failed,
}: {
  created: number;
  updated: number;
  unchanged: number;
  failed: number;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">导入结果</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-4 gap-3 text-sm">
        <div>新增 {created}</div>
        <div>更新 {updated}</div>
        <div>未变 {unchanged}</div>
        <div>失败 {failed}</div>
      </CardContent>
    </Card>
  );
}
