import type { Priority, WorkItem, WorkStatus } from "./workspace.ts";

/** Pure filtering and ordering for the list and board views. */

export type PriorityFilter = "all" | Priority;
export type TaskSort = "status" | "priority" | "newest" | "oldest";

export const taskSortLabels: Record<TaskSort, string> = {
  status: "Status, then priority",
  priority: "Priority first",
  newest: "Newest first",
  oldest: "Oldest first",
};

export const priorityRank: Record<Priority, number> = { High: 0, Normal: 1, Low: 2 };
const statusRank: Record<WorkStatus, number> = { todo: 0, doing: 1, done: 2 };

export function filterByPriority(items: WorkItem[], filter: PriorityFilter): WorkItem[] {
  return filter === "all" ? items : items.filter((item) => item.priority === filter);
}

export function sortTasks(items: WorkItem[], sort: TaskSort): WorkItem[] {
  const sorted = [...items];
  switch (sort) {
    case "status":
      return sorted.sort((first, second) =>
        statusRank[first.status] - statusRank[second.status] ||
        priorityRank[first.priority] - priorityRank[second.priority]);
    case "priority":
      return sorted.sort((first, second) =>
        priorityRank[first.priority] - priorityRank[second.priority] ||
        statusRank[first.status] - statusRank[second.status]);
    case "newest":
      return sorted.sort((first, second) => second.createdAt.localeCompare(first.createdAt));
    case "oldest":
      return sorted.sort((first, second) => first.createdAt.localeCompare(second.createdAt));
  }
}

export interface TaskCounts {
  total: number;
  byStatus: Record<WorkStatus, number>;
  /** Open (not done) tasks by priority. */
  openByPriority: Record<Priority, number>;
}

export function countTasks(items: WorkItem[]): TaskCounts {
  const counts: TaskCounts = {
    total: items.length,
    byStatus: { todo: 0, doing: 0, done: 0 },
    openByPriority: { High: 0, Normal: 0, Low: 0 },
  };
  for (const item of items) {
    counts.byStatus[item.status] += 1;
    if (item.status !== "done") counts.openByPriority[item.priority] += 1;
  }
  return counts;
}
