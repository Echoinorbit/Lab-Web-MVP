import type { ProjectSummary } from "../data";

export type TimelineGranularity = "month" | "week";

type TimelineSource = Pick<ProjectSummary, "createdAt" | "archivedAt" | "milestones">;

export type ProjectTimeline = {
  start: Date;
  end: Date;
  ticks: Date[];
};

function startOfMonth(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), 1);
}

function startOfWeek(value: Date) {
  const result = new Date(value);
  const day = result.getDay() || 7;
  result.setHours(0, 0, 0, 0);
  result.setDate(result.getDate() - day + 1);
  return result;
}

function addMonths(value: Date, amount: number) {
  return new Date(value.getFullYear(), value.getMonth() + amount, 1);
}

function addWeeks(value: Date, amount: number) {
  const result = new Date(value);
  result.setDate(result.getDate() + amount * 7);
  return result;
}

function startOfUnit(value: Date, granularity: TimelineGranularity) {
  return granularity === "month" ? startOfMonth(value) : startOfWeek(value);
}

function addUnit(value: Date, granularity: TimelineGranularity, amount = 1) {
  return granularity === "month" ? addMonths(value, amount) : addWeeks(value, amount);
}

/** Builds an exact project range, with six months of room for a just-created project. */
export function buildProjectTimeline(
  projects: readonly TimelineSource[],
  granularity: TimelineGranularity,
  now = new Date(),
): ProjectTimeline {
  const dates = [addMonths(now, -6), now];

  for (const project of projects) {
    dates.push(new Date(project.createdAt));
    dates.push(new Date(project.archivedAt ?? now));
    for (const milestone of project.milestones) dates.push(new Date(milestone.createdAt));
  }

  const earliest = new Date(Math.min(...dates.map((date) => date.getTime())));
  const latest = new Date(Math.max(...dates.map((date) => date.getTime())));
  const start = startOfUnit(earliest, granularity);
  const minimumEnd = addUnit(start, granularity, granularity === "month" ? 6 : 26);
  const nextEnd = addUnit(startOfUnit(latest, granularity), granularity);
  const end = nextEnd > minimumEnd ? nextEnd : minimumEnd;
  const ticks: Date[] = [];

  for (let tick = start; tick < end; tick = addUnit(tick, granularity)) ticks.push(tick);

  return { start, end, ticks };
}

export function getTimelinePosition(value: string | Date, timeline: Pick<ProjectTimeline, "start" | "end">) {
  const total = timeline.end.getTime() - timeline.start.getTime();
  if (total <= 0) return 0;
  const position = (new Date(value).getTime() - timeline.start.getTime()) / total;
  return Math.max(0, Math.min(100, position * 100));
}
