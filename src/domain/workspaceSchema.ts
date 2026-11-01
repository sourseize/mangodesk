import {
  ACTIVITY_LIMIT,
  activityActions,
  initialWorkspace,
  type ActivityEntry,
  type Priority,
  type WorkStatus,
  type Workstream,
  type Workspace,
  type WorkItem,
} from "./workspace.ts";

/**
 * Validation and migration of untrusted workspace documents (API payloads,
 * backups, data exported by older versions).
 */

interface StoredWorkItem extends Omit<WorkItem, "status" | "workstreamId"> {
  status?: WorkStatus;
  workstreamId?: string;
  /** Pre-status boolean flag. */
  completed?: boolean;
}

/** Activity shape used before the audit-trail model (kind + item title only). */
interface LegacyActivityEntry {
  id: string;
  itemTitle: string;
  kind: "created" | "started" | "completed" | "reopened";
  occurredAt: string;
}

type StoredActivityEntry = ActivityEntry | LegacyActivityEntry;

interface StoredWorkspace {
  items: StoredWorkItem[];
  activity: StoredActivityEntry[];
  workstreams?: Workstream[];
  focusQueue?: string[];
}

/** Returns a normalised workspace, or null when the value is not a workspace document. */
export function parseWorkspace(value: unknown): Workspace | null {
  if (!isStoredWorkspace(value)) return null;
  const items = value.items.map(migrateWorkItem);
  return {
    workstreams: value.workstreams ?? initialWorkspace.workstreams,
    items,
    activity: value.activity.map((entry) => migrateActivityEntry(entry, items)).slice(0, ACTIVITY_LIMIT),
    focusQueue: normaliseQueue(value.focusQueue ?? [], items),
  };
}

/** Keeps only unique ids of open tasks, in the stored order. */
export function normaliseQueue(queue: string[], items: WorkItem[]): string[] {
  const open = new Set(items.filter((item) => item.status !== "done").map((item) => item.id));
  return queue.filter((id, index) => open.has(id) && queue.indexOf(id) === index);
}

function isStoredWorkspace(value: unknown): value is StoredWorkspace {
  if (!isRecord(value) || !Array.isArray(value.items) || !Array.isArray(value.activity)) {
    return false;
  }
  return value.items.every(isStoredWorkItem) &&
    value.activity.every(isActivityEntry) &&
    (value.workstreams === undefined ||
      (Array.isArray(value.workstreams) && value.workstreams.every(isWorkstream))) &&
    (value.focusQueue === undefined ||
      (Array.isArray(value.focusQueue) && value.focusQueue.every((id) => typeof id === "string")));
}

function isStoredWorkItem(value: unknown): value is StoredWorkItem {
  if (!isRecord(value)) return false;
  return typeof value.id === "string" &&
    typeof value.title === "string" &&
    isPriority(value.priority) &&
    typeof value.createdAt === "string" &&
    (value.workstreamId === undefined || typeof value.workstreamId === "string") &&
    (value.status === undefined || isWorkStatus(value.status)) &&
    (value.completed === undefined || typeof value.completed === "boolean");
}

function isActivityEntry(value: unknown): value is StoredActivityEntry {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.occurredAt !== "string") return false;
  if ("kind" in value) {
    return typeof value.itemTitle === "string" &&
      ["created", "started", "completed", "reopened"].includes(String(value.kind));
  }
  return (activityActions as string[]).includes(String(value.action)) &&
    (value.entityType === "task" || value.entityType === "workstream") &&
    typeof value.entityId === "string" &&
    typeof value.title === "string" &&
    (value.workstreamId === undefined || typeof value.workstreamId === "string") &&
    (value.priority === undefined || isPriority(value.priority)) &&
    (value.from === undefined || typeof value.from === "string") &&
    (value.to === undefined || typeof value.to === "string");
}

function isWorkstream(value: unknown): value is Workstream {
  if (!isRecord(value)) return false;
  return typeof value.id === "string" &&
    typeof value.name === "string" &&
    ["leaf", "tomato", "mango", "coral"].includes(String(value.color)) &&
    ["active", "paused"].includes(String(value.status));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isPriority(value: unknown): value is Priority {
  return value === "Low" || value === "Normal" || value === "High";
}

function isWorkStatus(value: unknown): value is WorkStatus {
  return value === "todo" || value === "doing" || value === "done";
}

function migrateWorkItem(item: StoredWorkItem): WorkItem {
  return {
    id: item.id,
    title: item.title,
    priority: item.priority,
    workstreamId: item.workstreamId ?? initialWorkspace.workstreams[0].id,
    status: item.status ?? (item.completed ? "done" : "todo"),
    createdAt: item.createdAt,
  };
}

const legacyStatusByKind = { started: "doing", completed: "done", reopened: "todo" } as const;

function migrateActivityEntry(entry: StoredActivityEntry, items: WorkItem[]): ActivityEntry {
  if (!("kind" in entry)) return entry;
  // Legacy entries only knew the title; link them to a task by title when possible.
  const item = items.find((candidate) => candidate.title === entry.itemTitle);
  const base: ActivityEntry = {
    id: entry.id,
    occurredAt: entry.occurredAt,
    action: "task.created",
    entityType: "task",
    entityId: item?.id ?? "unknown",
    title: entry.itemTitle,
    ...(item ? { workstreamId: item.workstreamId, priority: item.priority } : {}),
  };
  if (entry.kind === "created") return base;
  return { ...base, action: "task.status_changed", to: legacyStatusByKind[entry.kind] };
}
