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

export type ActivityKind = "created" | "started" | "completed" | "reopened";

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
  itemTitle: string;
  kind: ActivityKind;
  occurredAt: string;
}

export interface Workspace {
  items: WorkItem[];
  activity: ActivityEntry[];
  workstreams: Workstream[];
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
  activity: [
    {
      id: "welcome-activity",
      itemTitle: "Your Mango Desk is ready",
      kind: "created",
      occurredAt: "2026-10-30T09:00:00.000Z",
    },
  ],
};

export const workstreamColors: WorkstreamColor[] = ["leaf", "tomato", "mango", "coral"];

export function createId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}
