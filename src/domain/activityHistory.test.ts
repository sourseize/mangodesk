import { describe, expect, it } from "vitest";
import {
  buildHistoryExport,
  emptyFilters,
  filterActivity,
  groupByDay,
  historyExportFilename,
  localDateKey,
} from "./activityHistory";
import type { ActivityEntry } from "./workspace";

// Local-time dates so grouping is stable regardless of the machine's zone.
const NOW = new Date(2026, 2, 10, 15, 0, 0); // 10 March 2026, 15:00 local
const at = (day: number, hour = 9) => new Date(2026, 2, day, hour, 0, 0).toISOString();

const entries: ActivityEntry[] = [
  { id: "1", occurredAt: at(10, 14), action: "task.status_changed", entityType: "task", entityId: "t1", title: "Write the report", workstreamId: "a", priority: "High", from: "doing", to: "done" },
  { id: "2", occurredAt: at(10, 8), action: "task.created", entityType: "task", entityId: "t2", title: "Call the bank", workstreamId: "b", priority: "Low" },
  { id: "3", occurredAt: at(9), action: "workstream.paused", entityType: "workstream", entityId: "b", title: "Finance", from: "active", to: "paused" },
  { id: "4", occurredAt: at(1), action: "workstream.created", entityType: "workstream", entityId: "a", title: "Alpha" },
];

describe("filterActivity", () => {
  it("returns everything with empty filters", () => {
    expect(filterActivity(entries, emptyFilters)).toEqual(entries);
  });

  it("matches the title case-insensitively", () => {
    expect(filterActivity(entries, { ...emptyFilters, query: "  BANK " }).map((entry) => entry.id)).toEqual(["2"]);
  });

  it("filters by entity type and by exact action", () => {
    expect(filterActivity(entries, { ...emptyFilters, action: "workstream" }).map((entry) => entry.id)).toEqual(["3", "4"]);
    expect(filterActivity(entries, { ...emptyFilters, action: "task" }).map((entry) => entry.id)).toEqual(["1", "2"]);
    expect(filterActivity(entries, { ...emptyFilters, action: "task.status_changed" }).map((entry) => entry.id)).toEqual(["1"]);
  });

  it("applies inclusive local date bounds", () => {
    expect(filterActivity(entries, { ...emptyFilters, from: "2026-03-09" }).map((entry) => entry.id)).toEqual(["1", "2", "3"]);
    expect(filterActivity(entries, { ...emptyFilters, to: "2026-03-09" }).map((entry) => entry.id)).toEqual(["3", "4"]);
    expect(filterActivity(entries, { ...emptyFilters, from: "2026-03-09", to: "2026-03-09" }).map((entry) => entry.id)).toEqual(["3"]);
  });

  it("filters by recorded priority; entries without one never match a specific level", () => {
    expect(filterActivity(entries, { ...emptyFilters, priority: "High" }).map((entry) => entry.id)).toEqual(["1"]);
    expect(filterActivity(entries, { ...emptyFilters, priority: "Normal" })).toEqual([]);
  });

  it("combines filters", () => {
    expect(filterActivity(entries, { query: "the", action: "task", priority: "all", from: "2026-03-10", to: "" }).map((entry) => entry.id)).toEqual(["1", "2"]);
  });
});

describe("groupByDay", () => {
  it("groups consecutive entries by local day with friendly labels", () => {
    const groups = groupByDay(entries, NOW);
    expect(groups.map((group) => [group.label, group.entries.map((entry) => entry.id)])).toEqual([
      ["Today", ["1", "2"]],
      ["Yesterday", ["3"]],
      ["Sunday, March 1", ["4"]],
    ]);
  });

  it("adds the year for dates outside the current year", () => {
    const old: ActivityEntry = { ...entries[3], occurredAt: new Date(2024, 11, 25, 10).toISOString() };
    expect(groupByDay([old], NOW)[0].label).toBe("Wednesday, December 25, 2024");
  });

  it("labels unparseable dates", () => {
    expect(groupByDay([{ ...entries[0], occurredAt: "nope" }], NOW)[0].label).toBe("Unknown date");
  });
});

describe("export", () => {
  it("builds a self-describing JSON payload", () => {
    const filters = { ...emptyFilters, action: "task" as const };
    const payload = buildHistoryExport(entries.slice(0, 2), filters, NOW);
    expect(payload).toEqual({
      app: "mango-desk",
      format: 1,
      exportedAt: NOW.toISOString(),
      filters,
      count: 2,
      entries: entries.slice(0, 2),
    });
  });

  it("names the file by local date", () => {
    expect(historyExportFilename(NOW)).toBe("mango-desk-history-2026-03-10.json");
    expect(localDateKey(NOW)).toBe("2026-03-10");
  });
});
