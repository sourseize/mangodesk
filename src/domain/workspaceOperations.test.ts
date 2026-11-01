import { describe, expect, it } from "vitest";
import type { Workspace } from "./workspace";
import { ACTIVITY_LIMIT } from "./workspace";
import {
  addItem,
  addWorkstream,
  dequeueItem,
  enqueueItem,
  moveInQueue,
  record,
  setItemStatus,
  toggleItem,
  toggleWorkstreamStatus,
  type OperationContext,
} from "./workspaceOperations";

function makeContext(): OperationContext {
  let counter = 0;
  return {
    id: () => `id-${++counter}`,
    now: () => `2026-01-01T00:00:0${counter}.000Z`,
  };
}

const baseWorkspace: Workspace = {
  workstreams: [
    { id: "ws-a", name: "Alpha", color: "mango", status: "active" },
    { id: "ws-b", name: "Beta", color: "leaf", status: "paused" },
  ],
  items: [
    { id: "item-1", title: "First", priority: "High", workstreamId: "ws-a", status: "todo", createdAt: "2025-12-31T00:00:00.000Z" },
    { id: "item-2", title: "Second", priority: "Low", workstreamId: "ws-b", status: "done", createdAt: "2025-12-31T00:00:00.000Z" },
  ],
  activity: [],
  focusQueue: [],
};

describe("addItem", () => {
  it("prepends a todo item and logs a created activity", () => {
    const result = addItem(baseWorkspace, { title: "New", priority: "Normal", workstreamId: "ws-a" }, makeContext());

    expect(result.items).toHaveLength(3);
    expect(result.items[0]).toEqual({
      id: "id-1",
      title: "New",
      priority: "Normal",
      workstreamId: "ws-a",
      status: "todo",
      createdAt: "2026-01-01T00:00:01.000Z",
    });
    expect(result.activity).toEqual([
      {
        id: "id-2",
        occurredAt: "2026-01-01T00:00:02.000Z",
        action: "task.created",
        entityType: "task",
        entityId: "id-1",
        title: "New",
        workstreamId: "ws-a",
        priority: "Normal",
      },
    ]);
  });

  it("does not mutate the input workspace", () => {
    const snapshot = structuredClone(baseWorkspace);
    addItem(baseWorkspace, { title: "New", priority: "Normal", workstreamId: "ws-a" }, makeContext());
    expect(baseWorkspace).toEqual(snapshot);
  });
});

describe("setItemStatus", () => {
  it("changes status and logs the transition with before/after values", () => {
    const result = setItemStatus(baseWorkspace, "item-1", "doing", makeContext());
    expect(result.items.find((item) => item.id === "item-1")?.status).toBe("doing");
    expect(result.activity[0]).toMatchObject({
      action: "task.status_changed",
      entityType: "task",
      entityId: "item-1",
      title: "First",
      workstreamId: "ws-a",
      priority: "High",
      from: "todo",
      to: "doing",
    });
  });

  it("returns the same workspace when the status is unchanged", () => {
    expect(setItemStatus(baseWorkspace, "item-1", "todo", makeContext())).toBe(baseWorkspace);
  });

  it("returns the same workspace for an unknown item", () => {
    expect(setItemStatus(baseWorkspace, "missing", "done", makeContext())).toBe(baseWorkspace);
  });
});

describe("toggleItem", () => {
  it("completes an open item", () => {
    const result = toggleItem(baseWorkspace, "item-1", makeContext());
    expect(result.items[0].status).toBe("done");
    expect(result.activity[0]).toMatchObject({ action: "task.status_changed", from: "todo", to: "done" });
  });

  it("reopens a done item", () => {
    const result = toggleItem(baseWorkspace, "item-2", makeContext());
    expect(result.items[1].status).toBe("todo");
    expect(result.activity[0]).toMatchObject({ action: "task.status_changed", from: "done", to: "todo" });
  });

  it("ignores unknown items", () => {
    expect(toggleItem(baseWorkspace, "missing", makeContext())).toBe(baseWorkspace);
  });
});

describe("workstreams", () => {
  it("appends a new active workstream and logs it", () => {
    const result = addWorkstream(baseWorkspace, "Gamma", "coral", makeContext());
    expect(result.workstreams).toHaveLength(3);
    expect(result.workstreams[2]).toEqual({ id: "id-1", name: "Gamma", color: "coral", status: "active" });
    expect(result.activity[0]).toMatchObject({
      action: "workstream.created",
      entityType: "workstream",
      entityId: "id-1",
      title: "Gamma",
    });
  });

  it("toggles between active and paused, logging each transition", () => {
    const paused = toggleWorkstreamStatus(baseWorkspace, "ws-a", makeContext());
    expect(paused.workstreams[0].status).toBe("paused");
    expect(paused.activity[0]).toMatchObject({ action: "workstream.paused", entityId: "ws-a", title: "Alpha", from: "active", to: "paused" });

    const active = toggleWorkstreamStatus(paused, "ws-a", makeContext());
    expect(active.workstreams[0].status).toBe("active");
    expect(active.activity[0]).toMatchObject({ action: "workstream.resumed", from: "paused", to: "active" });
  });

  it("ignores unknown workstreams", () => {
    expect(toggleWorkstreamStatus(baseWorkspace, "missing")).toBe(baseWorkspace);
  });
});

describe("focus queue", () => {
  const queued: Workspace = {
    ...baseWorkspace,
    items: [
      ...baseWorkspace.items,
      { id: "item-3", title: "Third", priority: "Normal", workstreamId: "ws-a", status: "doing", createdAt: "2025-12-31T00:00:00.000Z" },
      { id: "item-4", title: "Fourth", priority: "Normal", workstreamId: "ws-a", status: "todo", createdAt: "2025-12-31T00:00:00.000Z" },
    ],
    focusQueue: ["item-1", "item-3", "item-4"],
  };

  it("enqueues an open task at the end and logs its position", () => {
    const result = enqueueItem({ ...queued, focusQueue: ["item-1"] }, "item-3", makeContext());
    expect(result.focusQueue).toEqual(["item-1", "item-3"]);
    expect(result.activity[0]).toMatchObject({ action: "queue.added", entityId: "item-3", title: "Third", priority: "Normal", to: "2" });
  });

  it("refuses done, unknown and already-queued tasks", () => {
    expect(enqueueItem(queued, "item-2", makeContext())).toBe(queued);
    expect(enqueueItem(queued, "missing", makeContext())).toBe(queued);
    expect(enqueueItem(queued, "item-1", makeContext())).toBe(queued);
  });

  it("dequeues and logs the position it held", () => {
    const result = dequeueItem(queued, "item-3", makeContext());
    expect(result.focusQueue).toEqual(["item-1", "item-4"]);
    expect(result.activity[0]).toMatchObject({ action: "queue.removed", entityId: "item-3", from: "2" });
    expect(dequeueItem(queued, "item-2", makeContext())).toBe(queued);
  });

  it("moves within the queue, clamping the target and logging from → to", () => {
    const down = moveInQueue(queued, "item-1", 2, makeContext());
    expect(down.focusQueue).toEqual(["item-3", "item-4", "item-1"]);
    expect(down.activity[0]).toMatchObject({ action: "queue.moved", entityId: "item-1", from: "1", to: "3" });

    const clamped = moveInQueue(queued, "item-1", 99, makeContext());
    expect(clamped.focusQueue).toEqual(["item-3", "item-4", "item-1"]);

    const up = moveInQueue(queued, "item-4", -5, makeContext());
    expect(up.focusQueue).toEqual(["item-4", "item-1", "item-3"]);

    expect(moveInQueue(queued, "item-1", 0, makeContext())).toBe(queued);
    expect(moveInQueue(queued, "item-2", 0, makeContext())).toBe(queued);
  });

  it("drops a task from the queue when it is completed, and keeps it out when reopened", () => {
    const done = setItemStatus(queued, "item-3", "done", makeContext());
    expect(done.focusQueue).toEqual(["item-1", "item-4"]);
    expect(done.activity.map((entry) => entry.action)).toEqual(["queue.removed", "task.status_changed"]);

    const reopened = setItemStatus(done, "item-3", "todo", makeContext());
    expect(reopened.focusQueue).toEqual(["item-1", "item-4"]);
  });

  it("leaves the queue alone for other status changes", () => {
    const started = setItemStatus(queued, "item-1", "doing", makeContext());
    expect(started.focusQueue).toEqual(queued.focusQueue);
    expect(started.activity).toHaveLength(1);
  });
});

describe("record", () => {
  const draft = { action: "task.created", entityType: "task", entityId: "x", title: "X" } as const;

  it("stamps id and time and prepends newest first", () => {
    const context = makeContext();
    const once = record(baseWorkspace, draft, context);
    const twice = record(once, { ...draft, title: "Y" }, context);
    expect(twice.activity.map((entry) => entry.title)).toEqual(["Y", "X"]);
    expect(twice.activity[0]).toMatchObject({ id: "id-2", occurredAt: "2026-01-01T00:00:02.000Z" });
  });

  it("keeps only the most recent ACTIVITY_LIMIT entries", () => {
    const full: Workspace = {
      ...baseWorkspace,
      activity: Array.from({ length: ACTIVITY_LIMIT }, (_, index) => ({
        ...draft,
        id: `old-${index}`,
        occurredAt: "2025-01-01T00:00:00.000Z",
      })),
    };
    const result = record(full, { ...draft, title: "Newest" }, makeContext());
    expect(result.activity).toHaveLength(ACTIVITY_LIMIT);
    expect(result.activity[0].title).toBe("Newest");
    expect(result.activity.at(-1)?.id).toBe(`old-${ACTIVITY_LIMIT - 2}`);
  });
});
