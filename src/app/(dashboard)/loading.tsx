export default function DashboardLoading() {
  return (
    <div className="space-y-10" role="status" aria-label="页面正在加载">
      <div className="space-y-3 border-b border-border/70 pb-8">
        <div className="h-10 w-48 animate-pulse rounded-lg bg-muted motion-reduce:animate-none" />
        <div className="h-5 w-full max-w-xl animate-pulse rounded bg-muted motion-reduce:animate-none" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="h-36 animate-pulse rounded-2xl border border-border/70 bg-card motion-reduce:animate-none" />
        ))}
      </div>
      <span className="sr-only">正在加载，请稍候。</span>
    </div>
  );
}
