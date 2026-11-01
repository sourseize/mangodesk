import { describe, expect, it } from "vitest";
import { ACTIVITY_LIMIT, initialWorkspace, type Workspace } from "./workspace";
import { parseWorkspace } from "./workspaceSchema";

describe("parseWorkspace", () => {
  it("accepts a current workspace unchanged", () => {
    const workspace: Workspace = {
      workstreams: [{ id: "ws", name: "Stream", color: "leaf", status: "active" }],
      items: [{ id: "i", title: "Item", priority: "High", workstreamId: "ws", status: "doing", createdAt: "2026-01-01T00:00:00.000Z" }],
      activity: [{
        id: "a", occurredAt: "2026-01-01T00:00:00.000Z", action: "task.status_changed", entityType: "task",
        entityId: "i", title: "Item", workstreamId: "ws", from: "todo", to: "doing",
      }],
      focusQueue: ["i"],
    };
    expect(parseWorkspace(JSON.parse(JSON.stringify(workspace)))).toEqual(workspace);
  });

  it("defaults a missing queue and drops unknown, done or duplicate ids", () => {
    const items = [
      { id: "open", title: "Open", priority: "Low", workstreamId: "w", status: "todo", createdAt: "x" },
      { id: "finished", title: "Finished", priority: "Low", workstreamId: "w", status: "done", createdAt: "x" },
    ];
    expect(parseWorkspace({ items, activity: [] })?.focusQueue).toEqual([]);
    expect(parseWorkspace({ items, activity: [], focusQueue: ["finished", "ghost", "open", "open"] })?.focusQueue).toEqual(["open"]);
    expect(parseWorkspace({ items, activity: [], focusQueue: [1] })).toBeNull();
  });

  it("migrates legacy items that used a completed flag and had no workstream", () => {
    const parsed = parseWorkspace({
      items: [
        { id: "old-done", title: "Old done", priority: "Low", createdAt: "2025-01-01T00:00:00.000Z", completed: true },
        { id: "old-open", title: "Old open", priority: "Low", createdAt: "2025-01-01T00:00:00.000Z", completed: false },
      ],
      activity: [],
    });
    expect(parsed?.workstreams).toEqual(initialWorkspace.workstreams);
    expect(parsed?.items).toEqual([
      { id: "old-done", title: "Old done", priority: "Low", createdAt: "2025-01-01T00:00:00.000Z", status: "done", workstreamId: "personal" },
      { id: "old-open", title: "Old open", priority: "Low", createdAt: "2025-01-01T00:00:00.000Z", status: "todo", workstreamId: "personal" },
    ]);
  });

  it("migrates legacy activity entries to the audit-trail shape", () => {
    const parsed = parseWorkspace({
      workstreams: initialWorkspace.workstreams,
      items: [{ id: "t1", title: "Known task", priority: "Normal", workstreamId: "studio", status: "done", createdAt: "2025-01-01T00:00:00.000Z" }],
      activity: [
        { id: "a1", itemTitle: "Known task", kind: "completed", occurredAt: "2025-01-02T00:00:00.000Z" },
        { id: "a2", itemTitle: "Known task", kind: "started", occurredAt: "2025-01-01T12:00:00.000Z" },
        { id: "a3", itemTitle: "Known task", kind: "created", occurredAt: "2025-01-01T00:00:00.000Z" },
        { id: "a4", itemTitle: "Gone task", kind: "reopened", occurredAt: "2024-12-31T00:00:00.000Z" },
      ],
    });
    expect(parsed?.activity).toEqual([
      { id: "a1", occurredAt: "2025-01-02T00:00:00.000Z", action: "task.status_changed", entityType: "task", entityId: "t1", title: "Known task", workstreamId: "studio", priority: "Normal", to: "done" },
      { id: "a2", occurredAt: "2025-01-01T12:00:00.000Z", action: "task.status_changed", entityType: "task", entityId: "t1", title: "Known task", workstreamId: "studio", priority: "Normal", to: "doing" },
      { id: "a3", occurredAt: "2025-01-01T00:00:00.000Z", action: "task.created", entityType: "task", entityId: "t1", title: "Known task", workstreamId: "studio", priority: "Normal" },
      { id: "a4", occurredAt: "2024-12-31T00:00:00.000Z", action: "task.status_changed", entityType: "task", entityId: "unknown", title: "Gone task", to: "todo" },
    ]);
  });

  it("trims an oversized history to the limit", () => {
    const activity = Array.from({ length: ACTIVITY_LIMIT + 50 }, (_, index) => ({
      id: `e-${index}`, occurredAt: "2025-01-01T00:00:00.000Z", action: "task.created", entityType: "task", entityId: "x", title: `Entry ${index}`,
    }));
    const parsed = parseWorkspace({ items: [], activity });
    expect(parsed?.activity).toHaveLength(ACTIVITY_LIMIT);
    expect(parsed?.activity[0].id).toBe("e-0");
  });

  it.each([
    ["not an object", "nope"],
    ["missing arrays", { items: [] }],
    ["bad item", { items: [{ id: 1 }], activity: [] }],
    ["bad priority", { items: [{ id: "a", title: "t", priority: "Urgent", createdAt: "x" }], activity: [] }],
    ["bad activity priority", { items: [], activity: [{ id: "a", occurredAt: "x", action: "task.created", entityType: "task", entityId: "x", title: "X", priority: "Urgent" }] }],
    ["unknown action", { items: [], activity: [{ id: "a", occurredAt: "x", action: "task.exploded", entityType: "task", entityId: "x", title: "X" }] }],
    ["bad workstream", { items: [], activity: [], workstreams: [{ id: "w", name: "W", color: "blue", status: "active" }] }],
  ])("rejects %s", (_label, value) => {
    expect(parseWorkspace(value)).toBeNull();
  });
});
