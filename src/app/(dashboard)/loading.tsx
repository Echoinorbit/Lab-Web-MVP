export default function DashboardLoading() {
  return (
    <div className="space-y-10" role="status" aria-label="页面正在加载">
      <div className="space-y-4 pb-2">
        <div className="h-1 w-12 animate-pulse rounded-full bg-primary/60 motion-reduce:animate-none" />
        <div className="h-12 w-56 animate-pulse rounded-xl bg-muted motion-reduce:animate-none" />
        <div className="h-5 w-full max-w-2xl animate-pulse rounded bg-muted motion-reduce:animate-none" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="h-36 animate-pulse rounded-3xl border border-white/60 bg-card shadow-[var(--shadow-surface)] motion-reduce:animate-none dark:border-border/80" />
        ))}
      </div>
      <span className="sr-only">正在加载，请稍候。</span>
    </div>
  );
}
