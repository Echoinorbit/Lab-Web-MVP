import { getShanghaiDateParts } from "@/shared/lib/date";

export function resolveProgressPeriod(
  searchParams: { year?: string; month?: string },
  now = new Date(),
) {
  const current = getShanghaiDateParts(now);
  const parsedYear = Number(searchParams.year);
  const parsedMonth = Number(searchParams.month);
  const year = Number.isInteger(parsedYear) && parsedYear >= 2000 && parsedYear <= 2100
    ? parsedYear
    : current.year;
  const month = Number.isInteger(parsedMonth) && parsedMonth >= 1 && parsedMonth <= 12
    ? parsedMonth
    : current.month;
  const prev = month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
  const next = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
  return {
    year,
    month,
    prev,
    next,
    current: { year: current.year, month: current.month },
    isCurrent: year === current.year && month === current.month,
  };
}
