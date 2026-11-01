import { describe, expect, it } from "vitest";
import { generateSeedWorkspace, isSeedProfile, seedProfiles } from "./seedData";

const NOW = Date.UTC(2026, 5, 15, 12, 0, 0);

describe("generateSeedWorkspace", () => {
  it("is deterministic for the same seed", () => {
    const first = generateSeedWorkspace({ ...seedProfiles.demo, now: NOW });
    const second = generateSeedWorkspace({ ...seedProfiles.demo, now: NOW });
    expect(first).toEqual(second);
  });

  it("differs for a different seed", () => {
    const first = generateSeedWorkspace({ ...seedProfiles.demo, now: NOW });
    const second = generateSeedWorkspace({ ...seedProfiles.demo, seed: 99, now: NOW });
    expect(first.items.map((item) => item.title)).not.toEqual(second.items.map((item) => item.title));
  });

  it.each(["demo", "large"] as const)("profile %s honours its sizes and covers every state", (profile) => {
    const workspace = generateSeedWorkspace({ ...seedProfiles[profile], now: NOW });
    const sizes = seedProfiles[profile];

    expect(workspace.items).toHaveLength(sizes.items);
    expect(workspace.workstreams).toHaveLength(sizes.workstreams);

    const statuses = new Set(workspace.items.map((item) => item.status));
    const priorities = new Set(workspace.items.map((item) => item.priority));
    const streamStatuses = new Set(workspace.workstreams.map((stream) => stream.status));
    const actions = new Set(workspace.activity.map((entry) => entry.action));
    const transitions = new Set(workspace.activity
      .filter((entry) => entry.from && !entry.action.startsWith("queue."))
      .map((entry) => `${entry.from}>${entry.to}`));
    expect([...statuses].sort()).toEqual(["doing", "done", "todo"]);
    expect([...priorities].sort()).toEqual(["High", "Low", "Normal"]);
    expect([...streamStatuses].sort()).toEqual(["active", "paused"]);
    expect([...actions].sort()).toEqual(["queue.added", "queue.moved", "task.created", "task.status_changed", "workstream.created", "workstream.paused"]);
    expect(workspace.focusQueue.length).toBeGreaterThanOrEqual(3);
    expect(new Set(workspace.focusQueue).size).toBe(workspace.focusQueue.length);
    expect(workspace.focusQueue.every((id) => workspace.items.find((item) => item.id === id)?.status !== "done")).toBe(true);
    expect([...transitions].sort()).toEqual(["active>paused", "doing>done", "done>todo", "todo>doing", "todo>done"]);
  });

  it("produces unique ids and titles, valid workstream references and sorted timestamps", () => {
    const workspace = generateSeedWorkspace({ ...seedProfiles.large, now: NOW });
    const streamIds = new Set(workspace.workstreams.map((stream) => stream.id));

    expect(new Set(workspace.items.map((item) => item.id)).size).toBe(workspace.items.length);
    expect(new Set(workspace.items.map((item) => item.title)).size).toBe(workspace.items.length);
    expect(new Set(workspace.activity.map((entry) => entry.id)).size).toBe(workspace.activity.length);
    expect(workspace.items.every((item) => streamIds.has(item.workstreamId))).toBe(true);
    const itemIds = new Set(workspace.items.map((item) => item.id));
    expect(workspace.activity.every((entry) =>
      entry.entityType === "workstream" ? streamIds.has(entry.entityId) : itemIds.has(entry.entityId) && streamIds.has(entry.workstreamId ?? ""),
    )).toBe(true);

    const times = workspace.activity.map((entry) => new Date(entry.occurredAt).getTime());
    expect(times.every((time) => !Number.isNaN(time) && time <= NOW)).toBe(true);
    expect([...times].sort((a, b) => b - a)).toEqual(times);
  });

  it("keeps history within the requested window", () => {
    const days = 5;
    const workspace = generateSeedWorkspace({ seed: 3, items: 50, workstreams: 3, days, now: NOW });
    const oldest = Math.min(...workspace.items.map((item) => new Date(item.createdAt).getTime()));
    expect(NOW - oldest).toBeLessThanOrEqual(days * 24 * 60 * 60 * 1000);
  });

  it("recognises profile names", () => {
    expect(isSeedProfile("demo")).toBe(true);
    expect(isSeedProfile("large")).toBe(true);
    expect(isSeedProfile("clear")).toBe(false);
    expect(isSeedProfile(null)).toBe(false);
  });
});
