export const SHANGHAI_TIME_ZONE = "Asia/Shanghai";
export const PROGRESS_BACKFILL_WINDOW_HOURS = 24;

export type ShanghaiDateParts = {
  year: number;
  month: number;
  day: number;
};

const shanghaiFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: SHANGHAI_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function getShanghaiDateParts(date = new Date()): ShanghaiDateParts {
  const parts = shanghaiFormatter.formatToParts(date);
  const pick = (type: Intl.DateTimeFormatPartTypes) => {
    const value = parts.find((part) => part.type === type)?.value;
    if (!value) throw new Error(`Missing ${type} in Shanghai date.`);
    return Number(value);
  };
  return {
    year: pick("year"),
    month: pick("month"),
    day: pick("day"),
  };
}

export function getShanghaiDayWindowStart(date = new Date()) {
  const parts = getShanghaiDateParts(date);
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day - 1, 16, 0, 0, 0));
}

export function isCurrentShanghaiPeriod(year: number, month: number, date = new Date()) {
  const parts = getShanghaiDateParts(date);
  return parts.year === year && parts.month === month;
}

export function isProgressReportWindowOpen(date = new Date()) {
  const { day } = getShanghaiDateParts(date);
  return day >= 25 && day <= 27;
}

export function canWriteProgressReport(year: number, month: number, date = new Date()) {
  return isCurrentShanghaiPeriod(year, month, date) && isProgressReportWindowOpen(date);
}

export function getProgressBackfillExpiresAt(date = new Date()) {
  return new Date(date.getTime() + PROGRESS_BACKFILL_WINDOW_HOURS * 60 * 60 * 1000);
}
