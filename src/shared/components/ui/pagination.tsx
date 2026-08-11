import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import type { Route } from "next";

import { buttonStyles } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
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
  icon,
  className,
}: {
  label: string;
  page: number;
  disabled: boolean;
  basePath: string;
  params?: PaginationProps["params"];
  icon?: "previous" | "next";
  className?: string;
}) {
  const controlClassName = buttonStyles({
    variant: "secondary",
    size: "small",
    className: cn(
      "h-10 min-w-[7.5rem] rounded-none border-border bg-card px-4 font-mono text-[.8125rem] uppercase tracking-[.04em] hoverable:hover:border-primary hoverable:hover:bg-surface-raised",
      disabled && "cursor-not-allowed opacity-45",
      className,
    ),
  });
  const content = (
    <>
      {icon === "previous" ? <ChevronLeft className="h-4 w-4" aria-hidden="true" /> : null}
      <span>{label}</span>
      {icon === "next" ? <ChevronRight className="h-4 w-4" aria-hidden="true" /> : null}
    </>
  );

  return disabled ? (
    <span className={controlClassName} aria-disabled="true">
      {content}
    </span>
  ) : (
    <Link className={controlClassName} href={pageHref(basePath, page, params) as Route}>
      {content}
    </Link>
  );
}

export function Pagination({ basePath, currentPage, totalPages, params }: PaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <nav aria-label="分页" className="flex flex-col gap-4 border-y border-border bg-card px-8 py-5 text-sm landscape:flex-row landscape:flex-wrap landscape:items-center portrait:px-6">
      <div className="flex items-center gap-2">
        <PageControl
          label="上一页"
          icon="previous"
          page={currentPage - 1}
          disabled={currentPage <= 1}
          basePath={basePath}
          params={params}
        />
        <PageControl
          label="下一页"
          icon="next"
          page={currentPage + 1}
          disabled={currentPage >= totalPages}
          basePath={basePath}
          params={params}
        />
      </div>

      <span className="font-mono text-[.8125rem] uppercase tracking-[.05em] text-muted-foreground landscape:px-1">
        // 第 {currentPage} / {totalPages} 页
      </span>

      <form action={basePath} className="flex items-center gap-2 landscape:ml-auto">
        {Object.entries(params ?? {}).map(([key, value]) =>
          key !== "page" && value !== undefined ? <input key={key} type="hidden" name={key} value={value} /> : null,
        )}
        <label className="sr-only" htmlFor="pagination-page">
          跳转页码
        </label>
        <Input
          id="pagination-page"
          className="h-10 w-20 bg-background px-3 text-sm"
          name="page"
          type="number"
          min={1}
          max={totalPages}
          defaultValue={currentPage}
        />
        <button className={buttonStyles({ variant: "secondary", size: "small", className: "h-10 rounded-none px-4 font-mono text-[.8125rem] uppercase tracking-[.04em]" })} type="submit">
          跳转
        </button>
      </form>
    </nav>
  );
}
