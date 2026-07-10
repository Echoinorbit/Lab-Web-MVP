export const SHANGHAI_TIME_ZONE = "Asia/Shanghai";
export const PROGRESS_BACKFILL_WINDOW_HOURS = 24;

export type ShanghaiDateParts = {
  year: number;
  month: number;
  day: number;
};

export type ProgressWindow = {
  progressStartDay: number;
  progressStartMinute: number;
  progressEndDay: number;
  progressEndMinute: number;
};

export const DEFAULT_PROGRESS_WINDOW: ProgressWindow = {
  progressStartDay: 25,
  progressStartMinute: 0,
  progressEndDay: 27,
  progressEndMinute: 1439,
};

const shanghaiFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: SHANGHAI_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const shanghaiDateTimeFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: SHANGHAI_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

type DateInput = Date | string | number;

function asValidDate(value: DateInput) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new RangeError("Invalid date value.");
  return date;
}

function datePart(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes) {
  const value = parts.find((part) => part.type === type)?.value;
  if (!value) throw new Error(`Missing ${type} in Shanghai date.`);
  return value;
}

export function formatShanghaiDate(value: DateInput) {
  const parts = shanghaiFormatter.formatToParts(asValidDate(value));
  return `${datePart(parts, "year")}-${datePart(parts, "month")}-${datePart(parts, "day")}`;
}

export function formatShanghaiDateTime(value: DateInput) {
  const parts = shanghaiDateTimeFormatter.formatToParts(asValidDate(value));
  return `${datePart(parts, "year")}-${datePart(parts, "month")}-${datePart(parts, "day")} ${datePart(parts, "hour")}:${datePart(parts, "minute")}`;
}

export function getShanghaiDateParts(date = new Date()): ShanghaiDateParts {
  const parts = shanghaiFormatter.formatToParts(asValidDate(date));
  const pick = (type: Intl.DateTimeFormatPartTypes) => {
    return Number(datePart(parts, type));
  };
  return {
    year: pick("year"),
    month: pick("month"),
    day: pick("day"),
  };
}

export function getShanghaiDateTimeParts(date = new Date()) {
  const parts = shanghaiDateTimeFormatter.formatToParts(asValidDate(date));
  const pick = (type: Intl.DateTimeFormatPartTypes) => Number(datePart(parts, type));
  return {
    year: pick("year"),
    month: pick("month"),
    day: pick("day"),
    hour: pick("hour"),
    minute: pick("minute"),
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

export function isProgressReportWindowOpen(date = new Date(), window = DEFAULT_PROGRESS_WINDOW) {
  const { day, hour, minute } = getShanghaiDateTimeParts(date);
  const current = day * 1440 + hour * 60 + minute;
  const start = window.progressStartDay * 1440 + window.progressStartMinute;
  const end = window.progressEndDay * 1440 + window.progressEndMinute;
  return current >= start && current <= end;
}

export function canWriteProgressReport(
  year: number,
  month: number,
  date = new Date(),
  window = DEFAULT_PROGRESS_WINDOW,
) {
  return isCurrentShanghaiPeriod(year, month, date) && isProgressReportWindowOpen(date, window);
}

export function getProgressBackfillExpiresAt(date = new Date()) {
  return new Date(date.getTime() + PROGRESS_BACKFILL_WINDOW_HOURS * 60 * 60 * 1000);
}
