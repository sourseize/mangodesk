import { describe, expect, it } from "vitest";
import { describeAction, describeChange, toneFor } from "./activityPresentation";
import type { ActivityEntry } from "./workspace";

const base = { id: "x", occurredAt: "2026-01-01T00:00:00.000Z", entityId: "e", title: "Thing" };

describe("activity presentation", () => {
  it.each<[Partial<ActivityEntry>, string, string, string]>([
    [{ action: "task.created", entityType: "task" }, "added", "", "created"],
    [{ action: "task.status_changed", entityType: "task", from: "todo", to: "doing" }, "started", "Up next → In motion", "started"],
    [{ action: "task.status_changed", entityType: "task", from: "doing", to: "done" }, "wrapped up", "In motion → Done", "completed"],
    [{ action: "task.status_changed", entityType: "task", from: "done", to: "todo" }, "reopened", "Done → Up next", "reopened"],
    [{ action: "task.status_changed", entityType: "task", to: "done" }, "wrapped up", "Done", "completed"],
    [{ action: "workstream.created", entityType: "workstream" }, "created stream", "", "stream"],
    [{ action: "workstream.paused", entityType: "workstream", from: "active", to: "paused" }, "paused stream", "Active → Paused", "stream"],
    [{ action: "workstream.resumed", entityType: "workstream", from: "paused", to: "active" }, "resumed stream", "Paused → Active", "stream"],
  ])("%o", (partial, verb, change, tone) => {
    const entry = { ...base, ...partial } as ActivityEntry;
    expect(describeAction(entry)).toBe(verb);
    expect(describeChange(entry)).toBe(change);
    expect(toneFor(entry)).toBe(tone);
  });
});
