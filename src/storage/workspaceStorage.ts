import {
  initialWorkspace,
  type ActivityEntry,
  type Priority,
  type WorkStatus,
  type Workstream,
  type Workspace,
  type WorkItem,
} from "../domain/workspace";

const STORAGE_KEY = "mango-desk.workspace.v1";

interface StoredWorkItem extends Omit<WorkItem, "status" | "workstreamId"> {
  status?: WorkStatus;
  workstreamId?: string;
  completed?: boolean;
}

interface StoredWorkspace {
  items: StoredWorkItem[];
  activity: ActivityEntry[];
  workstreams?: Workstream[];
}

export function loadWorkspace(): Workspace {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return initialWorkspace;

    const parsed: unknown = JSON.parse(stored);
    if (isWorkspace(parsed)) {
      return {
        ...parsed,
        workstreams: parsed.workstreams ?? initialWorkspace.workstreams,
        items: parsed.items.map(migrateWorkItem),
      };
    }
    console.warn("Saved Mango Desk workspace had an invalid shape; starting fresh.");
  } catch (error) {
    console.warn("Could not read the saved Mango Desk workspace.", error);
  }
  return initialWorkspace;
}

export function saveWorkspace(workspace: Workspace): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace));
  } catch (error) {
    console.error("Could not save the Mango Desk workspace.", error);
  }
}

function isWorkspace(
  value: unknown,
): value is StoredWorkspace {
  if (!isRecord(value) || !Array.isArray(value.items) || !Array.isArray(value.activity)) {
    return false;
  }
  return value.items.every(isStoredWorkItem) &&
    value.activity.every(isActivityEntry) &&
    (value.workstreams === undefined ||
      (Array.isArray(value.workstreams) && value.workstreams.every(isWorkstream)));
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

function isActivityEntry(value: unknown): value is ActivityEntry {
  if (!isRecord(value)) return false;
  return typeof value.id === "string" &&
    typeof value.itemTitle === "string" &&
    typeof value.occurredAt === "string" &&
    ["created", "started", "completed", "reopened"].includes(String(value.kind));
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
