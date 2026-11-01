import {
  ACTIVITY_LIMIT,
  createId,
  type ActivityEntry,
  type Priority,
  type WorkItem,
  type WorkStatus,
  type Workspace,
  type Workstream,
  type WorkstreamColor,
} from "./workspace.ts";

/**
 * Pure state transitions for the workspace.
 *
 * Every function takes the current workspace and returns a new one (or the
 * same reference when nothing changed). Time and id generation are injected
 * through an OperationContext so the transitions are deterministic in tests.
 */

export interface OperationContext {
  id: () => string;
  now: () => string;
}

export const liveContext: OperationContext = {
  id: createId,
  now: () => new Date().toISOString(),
};

export interface NewItemInput {
  title: string;
  priority: Priority;
  workstreamId: string;
}

export function addItem(
  workspace: Workspace,
  input: NewItemInput,
  context: OperationContext = liveContext,
): Workspace {
  const item: WorkItem = {
    id: context.id(),
    title: input.title,
    priority: input.priority,
    workstreamId: input.workstreamId,
    status: "todo",
    createdAt: context.now(),
  };
  return record(
    { ...workspace, items: [item, ...workspace.items] },
    { action: "task.created", entityType: "task", entityId: item.id, title: item.title, workstreamId: item.workstreamId, priority: item.priority },
    context,
  );
}

export function setItemStatus(
  workspace: Workspace,
  itemId: string,
  status: WorkStatus,
  context: OperationContext = liveContext,
): Workspace {
  const item = workspace.items.find((candidate) => candidate.id === itemId);
  if (!item || item.status === status) return workspace;
  const updated = { ...item, status };
  const next = record(
    { ...workspace, items: workspace.items.map((candidate) => (candidate.id === itemId ? updated : candidate)) },
    {
      action: "task.status_changed",
      entityType: "task",
      entityId: item.id,
      title: item.title,
      workstreamId: item.workstreamId,
      priority: item.priority,
      from: item.status,
      to: status,
    },
    context,
  );
  // Finished work leaves the focus queue on its own.
  return status === "done" ? dequeueItem(next, itemId, context) : next;
}

/** Adds an open task to the end of the focus queue. */
export function enqueueItem(
  workspace: Workspace,
  itemId: string,
  context: OperationContext = liveContext,
): Workspace {
  const item = workspace.items.find((candidate) => candidate.id === itemId);
  if (!item || item.status === "done" || workspace.focusQueue.includes(itemId)) return workspace;
  const focusQueue = [...workspace.focusQueue, itemId];
  return record(
    { ...workspace, focusQueue },
    { ...queueDraft(item), action: "queue.added", to: String(focusQueue.length) },
    context,
  );
}

export function dequeueItem(
  workspace: Workspace,
  itemId: string,
  context: OperationContext = liveContext,
): Workspace {
  const position = workspace.focusQueue.indexOf(itemId);
  const item = workspace.items.find((candidate) => candidate.id === itemId);
  if (position === -1 || !item) return workspace;
  return record(
    { ...workspace, focusQueue: workspace.focusQueue.filter((id) => id !== itemId) },
    { ...queueDraft(item), action: "queue.removed", from: String(position + 1) },
    context,
  );
}

/** Moves a queued task to a zero-based index (clamped to the queue bounds). */
export function moveInQueue(
  workspace: Workspace,
  itemId: string,
  toIndex: number,
  context: OperationContext = liveContext,
): Workspace {
  const from = workspace.focusQueue.indexOf(itemId);
  const item = workspace.items.find((candidate) => candidate.id === itemId);
  if (from === -1 || !item) return workspace;
  const to = Math.min(Math.max(0, Math.trunc(toIndex)), workspace.focusQueue.length - 1);
  if (to === from) return workspace;
  const focusQueue = [...workspace.focusQueue];
  focusQueue.splice(from, 1);
  focusQueue.splice(to, 0, itemId);
  return record(
    { ...workspace, focusQueue },
    { ...queueDraft(item), action: "queue.moved", from: String(from + 1), to: String(to + 1) },
    context,
  );
}

function queueDraft(item: WorkItem) {
  return {
    entityType: "task" as const,
    entityId: item.id,
    title: item.title,
    workstreamId: item.workstreamId,
    priority: item.priority,
  };
}

export function toggleItem(
  workspace: Workspace,
  itemId: string,
  context: OperationContext = liveContext,
): Workspace {
  const item = workspace.items.find((candidate) => candidate.id === itemId);
  if (!item) return workspace;
  return setItemStatus(workspace, itemId, item.status === "done" ? "todo" : "done", context);
}

export function addWorkstream(
  workspace: Workspace,
  name: string,
  color: WorkstreamColor,
  context: OperationContext = liveContext,
): Workspace {
  const workstream: Workstream = {
    id: context.id(),
    name,
    color,
    status: "active",
  };
  return record(
    { ...workspace, workstreams: [...workspace.workstreams, workstream] },
    { action: "workstream.created", entityType: "workstream", entityId: workstream.id, title: workstream.name },
    context,
  );
}

export function toggleWorkstreamStatus(
  workspace: Workspace,
  workstreamId: string,
  context: OperationContext = liveContext,
): Workspace {
  const workstream = workspace.workstreams.find((candidate) => candidate.id === workstreamId);
  if (!workstream) return workspace;
  const status = workstream.status === "active" ? "paused" : "active";
  return record(
    {
      ...workspace,
      workstreams: workspace.workstreams.map((candidate) =>
        candidate.id === workstreamId ? { ...candidate, status } : candidate,
      ),
    },
    {
      action: status === "paused" ? "workstream.paused" : "workstream.resumed",
      entityType: "workstream",
      entityId: workstream.id,
      title: workstream.name,
      from: workstream.status,
      to: status,
    },
    context,
  );
}

export type ActivityDraft = Omit<ActivityEntry, "id" | "occurredAt">;

/**
 * The single place where history is written: stamps the draft, prepends it
 * (newest first) and trims the log to ACTIVITY_LIMIT entries.
 */
export function record(workspace: Workspace, draft: ActivityDraft, context: OperationContext = liveContext): Workspace {
  const entry: ActivityEntry = { id: context.id(), occurredAt: context.now(), ...draft };
  return { ...workspace, activity: [entry, ...workspace.activity].slice(0, ACTIVITY_LIMIT) };
}
