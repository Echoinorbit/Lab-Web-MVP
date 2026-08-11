import assert from "node:assert/strict";
import test from "node:test";

import { buildProjectTimeline, getTimelinePosition } from "../src/features/projects/lib/project-timeline";

test("刚创建的项目也应获得至少六个月且可定位的时间轴", () => {
  const timeline = buildProjectTimeline([{
    createdAt: "2026-08-10T00:00:00.000Z",
    archivedAt: null,
    milestones: [],
  }], "month", new Date("2026-08-10T00:00:00.000Z"));

  assert.equal(timeline.ticks.length >= 6, true);
  assert.equal(getTimelinePosition("2026-08-10T00:00:00.000Z", timeline) > 0, true);
});

test("跨度很大的项目与节点必须保持在同一可滚动范围内", () => {
  const timeline = buildProjectTimeline([{
    createdAt: "2021-01-05T00:00:00.000Z",
    archivedAt: null,
    milestones: [{ id: "late", title: "最近节点", createdAt: "2026-08-01T00:00:00.000Z", colorHex: null }],
  }], "month", new Date("2026-08-10T00:00:00.000Z"));

  assert.equal(timeline.ticks.length > 60, true);
  assert.equal(getTimelinePosition("2021-01-05T00:00:00.000Z", timeline) < getTimelinePosition("2026-08-01T00:00:00.000Z", timeline), true);
});
