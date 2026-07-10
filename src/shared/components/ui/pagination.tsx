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
    className: cn("min-w-9", disabled && "cursor-not-allowed opacity-45", className),
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
    <nav aria-label="分页" className="flex flex-col gap-3 text-sm sm:flex-row sm:flex-wrap sm:items-center">
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

      <span className="tabular-nums text-muted-foreground sm:px-1">
        第 {currentPage} / {totalPages} 页
      </span>

      <form action={basePath} className="flex items-center gap-2 sm:ml-auto">
        {Object.entries(params ?? {}).map(([key, value]) =>
          key !== "page" && value !== undefined ? <input key={key} type="hidden" name={key} value={value} /> : null,
        )}
        <label className="sr-only" htmlFor="pagination-page">
          跳转页码
        </label>
        <Input
          id="pagination-page"
          className="h-9 w-20 bg-card px-3 text-sm"
          name="page"
          type="number"
          min={1}
          max={totalPages}
          defaultValue={currentPage}
        />
        <button className={buttonStyles({ variant: "secondary", size: "small" })} type="submit">
          跳转
        </button>
      </form>
    </nav>
  );
}
