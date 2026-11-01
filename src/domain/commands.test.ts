import { describe, expect, it } from "vitest";
import { applyCommand, findCommandTarget, parseCommand } from "./commands";
import { initialWorkspace } from "./workspace";
import type { OperationContext } from "./workspaceOperations";

const context: OperationContext = { id: () => "new-id", now: () => "2026-01-01T00:00:00.000Z" };

describe("parseCommand", () => {
  it("accepts well-formed commands and trims text", () => {
    expect(parseCommand({ type: "addItem", title: "  Hello ", priority: "High", workstreamId: "personal" })).toEqual({
      ok: true,
      command: { type: "addItem", title: "Hello", priority: "High", workstreamId: "personal" },
    });
    expect(parseCommand({ type: "toggleItem", itemId: "a" })).toEqual({ ok: true, command: { type: "toggleItem", itemId: "a" } });
    expect(parseCommand({ type: "setItemStatus", itemId: "a", status: "doing" })).toMatchObject({ ok: true });
    expect(parseCommand({ type: "addWorkstream", name: " Garden ", color: "leaf" })).toEqual({
      ok: true,
      command: { type: "addWorkstream", name: "Garden", color: "leaf" },
    });
    expect(parseCommand({ type: "toggleWorkstreamStatus", workstreamId: "w" })).toMatchObject({ ok: true });
    expect(parseCommand({ type: "enqueueItem", itemId: "a" })).toEqual({ ok: true, command: { type: "enqueueItem", itemId: "a" } });
    expect(parseCommand({ type: "dequeueItem", itemId: "a" })).toEqual({ ok: true, command: { type: "dequeueItem", itemId: "a" } });
    expect(parseCommand({ type: "moveInQueue", itemId: "a", toIndex: 2 })).toEqual({ ok: true, command: { type: "moveInQueue", itemId: "a", toIndex: 2 } });
  });

  it.each([
    [null, "Command must be an object."],
    [{ type: "explode" }, "Unknown command type."],
    [{ type: "addItem", title: "", priority: "High", workstreamId: "p" }, "title must be 1–120 characters."],
    [{ type: "addItem", title: "x".repeat(121), priority: "High", workstreamId: "p" }, "title must be 1–120 characters."],
    [{ type: "addItem", title: "ok", priority: "Urgent", workstreamId: "p" }, "priority must be Low, Normal or High."],
    [{ type: "addItem", title: "ok", priority: "Low" }, "workstreamId is required."],
    [{ type: "toggleItem" }, "itemId is required."],
    [{ type: "setItemStatus", itemId: "a", status: "later" }, "status must be todo, doing or done."],
    [{ type: "addWorkstream", name: "x", color: "blue" }, "color must be one of leaf, tomato, mango, coral."],
    [{ type: "addWorkstream", name: "   ", color: "leaf" }, "name must be 1–32 characters."],
    [{ type: "toggleWorkstreamStatus" }, "workstreamId is required."],
    [{ type: "enqueueItem" }, "itemId is required."],
    [{ type: "moveInQueue", itemId: "a", toIndex: -1 }, "toIndex must be a non-negative integer."],
    [{ type: "moveInQueue", itemId: "a", toIndex: 1.5 }, "toIndex must be a non-negative integer."],
    [{ type: "moveInQueue", itemId: "a", toIndex: "2" }, "toIndex must be a non-negative integer."],
  ])("rejects %j", (payload, error) => {
    expect(parseCommand(payload)).toEqual({ ok: false, error });
  });

  it("ignores extra properties", () => {
    const result = parseCommand({ type: "toggleItem", itemId: "a", admin: true });
    expect(result).toEqual({ ok: true, command: { type: "toggleItem", itemId: "a" } });
  });
});

describe("findCommandTarget", () => {
  it("reports missing tasks and workstreams", () => {
    expect(findCommandTarget(initialWorkspace, { type: "toggleItem", itemId: "welcome-plan" })).toBeNull();
    expect(findCommandTarget(initialWorkspace, { type: "toggleItem", itemId: "nope" })).toBe("Task not found.");
    expect(findCommandTarget(initialWorkspace, { type: "setItemStatus", itemId: "nope", status: "done" })).toBe("Task not found.");
    expect(findCommandTarget(initialWorkspace, { type: "addItem", title: "x", priority: "Low", workstreamId: "nope" })).toBe("Workstream not found.");
    expect(findCommandTarget(initialWorkspace, { type: "toggleWorkstreamStatus", workstreamId: "nope" })).toBe("Workstream not found.");
    expect(findCommandTarget(initialWorkspace, { type: "addWorkstream", name: "x", color: "leaf" })).toBeNull();
    expect(findCommandTarget(initialWorkspace, { type: "moveInQueue", itemId: "nope", toIndex: 0 })).toBe("Task not found.");
    expect(findCommandTarget(initialWorkspace, { type: "enqueueItem", itemId: "welcome-plan" })).toBeNull();
  });
});

describe("applyCommand", () => {
  it("routes each command to the matching operation and records history", () => {
    let workspace = applyCommand(initialWorkspace, { type: "addItem", title: "New", priority: "Low", workstreamId: "studio" }, context);
    expect(workspace.items[0]).toMatchObject({ id: "new-id", title: "New", status: "todo" });
    expect(workspace.activity[0]).toMatchObject({ action: "task.created", title: "New" });

    workspace = applyCommand(workspace, { type: "setItemStatus", itemId: "new-id", status: "doing" }, context);
    expect(workspace.items[0].status).toBe("doing");

    workspace = applyCommand(workspace, { type: "toggleItem", itemId: "new-id" }, context);
    expect(workspace.items[0].status).toBe("done");

    workspace = applyCommand(workspace, { type: "addWorkstream", name: "Garden", color: "coral" }, context);
    expect(workspace.workstreams.at(-1)).toMatchObject({ name: "Garden", status: "active" });

    workspace = applyCommand(workspace, { type: "toggleWorkstreamStatus", workstreamId: "new-id" }, context);
    expect(workspace.workstreams.at(-1)?.status).toBe("paused");

    workspace = applyCommand(workspace, { type: "enqueueItem", itemId: "welcome-ideas" }, context);
    workspace = applyCommand(workspace, { type: "moveInQueue", itemId: "welcome-ideas", toIndex: 0 }, context);
    workspace = applyCommand(workspace, { type: "dequeueItem", itemId: "welcome-ideas" }, context);
    expect(workspace.focusQueue).toEqual(["welcome-plan"]);
    expect(workspace.activity.map((entry) => entry.action)).toEqual([
      "queue.removed", "queue.moved", "workstream.paused", "workstream.created",
      "task.status_changed", "task.status_changed", "task.created", "task.created",
    ]);
  });
});
