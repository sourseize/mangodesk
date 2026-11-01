export type Priority = "Low" | "Normal" | "High";
export type WorkStatus = "todo" | "doing" | "done";
export type WorkstreamColor = "leaf" | "tomato" | "mango" | "coral";
export type WorkstreamStatus = "active" | "paused";

export interface Workstream {
  id: string;
  name: string;
  color: WorkstreamColor;
  status: WorkstreamStatus;
}

/**
 * Audit trail of user actions on the workspace (tasks, workstreams, queue).
 * This is an application-level history of what the user did, not a tracker
 * of input events.
 */
export type ActivityAction =
  | "task.created"
  | "task.status_changed"
  | "workstream.created"
  | "workstream.paused"
  | "workstream.resumed"
  | "queue.added"
  | "queue.removed"
  | "queue.moved";

export type ActivityEntityType = "task" | "workstream";

export const activityActions: ActivityAction[] = [
  "task.created",
  "task.status_changed",
  "workstream.created",
  "workstream.paused",
  "workstream.resumed",
  "queue.added",
  "queue.removed",
  "queue.moved",
];

/** Only the most recent entries are kept so local storage stays bounded. */
export const ACTIVITY_LIMIT = 1000;

export interface WorkItem {
  id: string;
  title: string;
  priority: Priority;
  workstreamId: string;
  status: WorkStatus;
  createdAt: string;
}

export interface ActivityEntry {
  id: string;
  occurredAt: string;
  action: ActivityAction;
  entityType: ActivityEntityType;
  /** Id of the task/workstream the action applied to. */
  entityId: string;
  /** Name of the entity at the time of the action. */
  title: string;
  /** Workstream the task belonged to (task actions only). */
  workstreamId?: string;
  /** Priority of the task at the time of the action (task actions only). */
  priority?: Priority;
  /** Previous and new value for change actions (e.g. task status). */
  from?: string;
  to?: string;
}

export interface Workspace {
  items: WorkItem[];
  activity: ActivityEntry[];
  workstreams: Workstream[];
  /** Ordered ids of open tasks the user has lined up to work on next. */
  focusQueue: string[];
}

export const initialWorkspace: Workspace = {
  workstreams: [
    { id: "personal", name: "Personal", color: "mango", status: "active" },
    { id: "studio", name: "Studio", color: "tomato", status: "active" },
    { id: "home", name: "Home", color: "leaf", status: "paused" },
  ],
  items: [
    {
      id: "welcome-plan",
      title: "Sketch out the week’s big rocks",
      priority: "High",
      workstreamId: "personal",
      status: "todo",
      createdAt: "2026-10-30T08:30:00.000Z",
    },
    {
      id: "welcome-ideas",
      title: "Collect the loose ideas in one place",
      priority: "Normal",
      workstreamId: "studio",
      status: "doing",
      createdAt: "2026-10-30T08:45:00.000Z",
    },
    {
      id: "welcome-coffee",
      title: "Take a real lunch break",
      priority: "Low",
      workstreamId: "personal",
      status: "done",
      createdAt: "2026-10-30T09:00:00.000Z",
    },
  ],
  focusQueue: ["welcome-plan", "welcome-ideas"],
  activity: [
    {
      id: "welcome-activity",
      occurredAt: "2026-10-30T09:00:00.000Z",
      action: "task.created",
      entityType: "task",
      entityId: "welcome-plan",
      title: "Sketch out the week’s big rocks",
      workstreamId: "personal",
      priority: "High",
    },
  ],
};

export const workstreamColors: WorkstreamColor[] = ["leaf", "tomato", "mango", "coral"];
export const priorities: Priority[] = ["High", "Normal", "Low"];

export function createId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}
