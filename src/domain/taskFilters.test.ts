import { describe, expect, it } from "vitest";
import { countTasks, filterByPriority, sortTasks } from "./taskFilters";
import type { WorkItem } from "./workspace";

const item = (id: string, priority: WorkItem["priority"], status: WorkItem["status"], day: number): WorkItem => ({
  id, title: id, priority, status, workstreamId: "w", createdAt: `2026-01-${String(day).padStart(2, "0")}T00:00:00.000Z`,
});

const items = [
  item("a", "Low", "done", 1),
  item("b", "High", "todo", 2),
  item("c", "Normal", "doing", 3),
  item("d", "High", "doing", 4),
  item("e", "Normal", "todo", 5),
];

describe("filterByPriority", () => {
  it("passes everything through for 'all' and narrows otherwise", () => {
    expect(filterByPriority(items, "all")).toBe(items);
    expect(filterByPriority(items, "High").map((entry) => entry.id)).toEqual(["b", "d"]);
    expect(filterByPriority(items, "Low").map((entry) => entry.id)).toEqual(["a"]);
  });
});

describe("sortTasks", () => {
  it.each([
    ["status", ["b", "e", "d", "c", "a"]],
    ["priority", ["b", "d", "e", "c", "a"]],
    ["newest", ["e", "d", "c", "b", "a"]],
    ["oldest", ["a", "b", "c", "d", "e"]],
  ] as const)("orders by %s", (sort, expected) => {
    expect(sortTasks(items, sort).map((entry) => entry.id)).toEqual(expected);
  });

  it("does not mutate the input", () => {
    const copy = [...items];
    sortTasks(items, "priority");
    expect(items).toEqual(copy);
  });
});

describe("countTasks", () => {
  it("counts by status and open tasks by priority", () => {
    expect(countTasks(items)).toEqual({
      total: 5,
      byStatus: { todo: 2, doing: 2, done: 1 },
      openByPriority: { High: 2, Normal: 2, Low: 0 },
    });
  });
});
