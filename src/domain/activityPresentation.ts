import type { ActivityAction, ActivityEntry, WorkStatus } from "./workspace.ts";

/** Human-readable labels shared by the activity feed and the history view. */

export const statusLabels: Record<WorkStatus, string> = {
  todo: "Up next",
  doing: "In motion",
  done: "Done",
};

export const actionLabels: Record<ActivityAction, string> = {
  "task.created": "Task added",
  "task.status_changed": "Task status changed",
  "workstream.created": "Workstream created",
  "workstream.paused": "Workstream paused",
  "workstream.resumed": "Workstream resumed",
  "queue.added": "Added to queue",
  "queue.removed": "Removed from queue",
  "queue.moved": "Queue reordered",
};

/** Short verb phrase used in the "latest moves" feed, e.g. "wrapped up". */
export function describeAction(entry: ActivityEntry): string {
  switch (entry.action) {
    case "task.created":
      return "added";
    case "task.status_changed":
      if (entry.to === "doing") return "started";
      if (entry.to === "done") return "wrapped up";
      return "reopened";
    case "workstream.created":
      return "created stream";
    case "workstream.paused":
      return "paused stream";
    case "workstream.resumed":
      return "resumed stream";
    case "queue.added":
      return "queued";
    case "queue.removed":
      return "unqueued";
    case "queue.moved":
      return "moved in queue";
  }
}

/** "Up next → Done" style summary of a change, or an empty string when there is none. */
export function describeChange(entry: ActivityEntry): string {
  if (entry.action === "queue.added") return `#${entry.to}`;
  if (entry.action === "queue.removed") return `was #${entry.from}`;
  if (entry.to === undefined) return "";
  const from = entry.from === undefined ? "" : `${labelFor(entry.from)} → `;
  return `${from}${labelFor(entry.to)}`;
}

function labelFor(value: string): string {
  if (value in statusLabels) return statusLabels[value as WorkStatus];
  if (/^\d+$/.test(value)) return `#${value}`;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** CSS modifier describing the tone of an entry (used for the timeline dots). */
export function toneFor(entry: ActivityEntry): "created" | "started" | "completed" | "reopened" | "stream" | "queue" {
  if (entry.entityType === "workstream") return "stream";
  if (entry.action.startsWith("queue.")) return "queue";
  if (entry.action === "task.created") return "created";
  if (entry.to === "doing") return "started";
  if (entry.to === "done") return "completed";
  return "reopened";
}
