import Link from "next/link";
import type { Route } from "next";

import { cn } from "@/shared/lib/utils";

type PaginationProps = {
  basePath: string;
  currentPage: number;
  totalPages: number;
  params?: Record<string, string | number | undefined>;
};

function pageHref(basePath: string, page: number, params: PaginationProps["params"]) {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params ?? {})) {
    if (key === "page" || value === undefined) continue;
    searchParams.set(key, String(value));
  }
  searchParams.set("page", String(page));
  return `${basePath}?${searchParams.toString()}`;
}

function PageControl({
  label,
  page,
  disabled,
  basePath,
  params,
}: {
  label: string;
  page: number;
  disabled: boolean;
  basePath: string;
  params?: PaginationProps["params"];
}) {
  const className = cn(
    "inline-flex h-10 items-center justify-center rounded-full border px-4 text-sm transition-[color,background-color,border-color] duration-[var(--motion-fast)] ease-[var(--ease-fluid)]",
    disabled
      ? "cursor-not-allowed text-muted-foreground opacity-50"
      : "hover:border-foreground/20 hover:bg-muted hover:text-foreground active:bg-muted/80",
  );

  return disabled ? (
    <span className={className} aria-disabled="true">
      {label}
    </span>
  ) : (
    <Link className={className} href={pageHref(basePath, page, params) as Route}>
      {label}
    </Link>
  );
}

export function Pagination({ basePath, currentPage, totalPages, params }: PaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <nav aria-label="分页" className="flex flex-wrap items-center gap-2 text-sm">
      <PageControl label="首页" page={1} disabled={currentPage <= 1} basePath={basePath} params={params} />
      <PageControl label="上一页" page={currentPage - 1} disabled={currentPage <= 1} basePath={basePath} params={params} />
      <span className="px-1 tabular-nums text-muted-foreground">
        第 {currentPage} / {totalPages} 页
      </span>
      <form action={basePath} className="flex items-center gap-2">
        {Object.entries(params ?? {}).map(([key, value]) =>
          key !== "page" && value !== undefined ? <input key={key} type="hidden" name={key} value={value} /> : null,
        )}
        <label className="sr-only" htmlFor="pagination-page">
          跳转页码
        </label>
        <input
          id="pagination-page"
          className="h-10 w-20 rounded-lg border bg-card px-3 text-sm outline-none transition-[border-color,box-shadow] duration-[var(--motion-fast)] ease-[var(--ease-fluid)] hover:border-foreground/20 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20"
          name="page"
          type="number"
          min={1}
          max={totalPages}
          defaultValue={currentPage}
        />
        <button className="h-10 rounded-full border px-4 transition-colors duration-[var(--motion-fast)] ease-[var(--ease-fluid)] hover:bg-muted active:bg-muted/80" type="submit">
          跳转
        </button>
      </form>
      <PageControl label="下一页" page={currentPage + 1} disabled={currentPage >= totalPages} basePath={basePath} params={params} />
      <PageControl label="末页" page={totalPages} disabled={currentPage >= totalPages} basePath={basePath} params={params} />
    </nav>
  );
}
