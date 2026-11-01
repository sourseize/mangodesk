import type { WorkItem } from "../domain/workspace";
import { usePagination } from "../hooks/usePagination";
import { Pagination } from "./Pagination";
import { QueueToggle } from "./QueueToggle";

interface TaskListProps {
  items: WorkItem[];
  queuedIds: Set<string>;
  onToggle: (itemId: string) => void;
  onToggleQueue: (itemId: string, queued: boolean) => void;
  pageSize?: number;
}

export const TASK_PAGE_SIZE = 20;

/** Items are rendered in the order given; sorting happens in the parent. */
export function TaskList({ items, queuedIds, onToggle, onToggleQueue, pageSize = TASK_PAGE_SIZE }: TaskListProps) {
  const pagination = usePagination(items, pageSize);

  if (items.length === 0) {
    return (
      <div className="empty-state">
        <span aria-hidden="true">✳</span>
        <strong>Nothing here right now.</strong>
        <p>Add a task above, or widen the priority filter.</p>
      </div>
    );
  }

  return (
    <>
      <ul className="task-list">
        {pagination.pageItems.map((item) => (
          <li className={`task-row${item.status === "done" ? " is-complete" : ""}${item.status === "doing" ? " is-doing" : ""}`} key={item.id}>
            <button
              className="task-check"
              type="button"
              onClick={() => onToggle(item.id)}
              aria-label={item.status === "done" ? `Reopen ${item.title}` : `Complete ${item.title}`}
              aria-pressed={item.status === "done"}
            >
              {item.status === "done" && <span aria-hidden="true">✓</span>}
            </button>
            <span className="task-title">{item.title}</span>
            {item.status === "doing" && <span className="task-state">IN MOTION</span>}
            {item.status !== "done" && (
              <QueueToggle item={item} queued={queuedIds.has(item.id)} onToggle={onToggleQueue} />
            )}
            <span className={`priority priority-${item.priority.toLowerCase()}`}>
              <span aria-hidden="true">●</span> {item.priority}
            </span>
          </li>
        ))}
      </ul>
      <Pagination pagination={pagination} label="tasks" />
    </>
  );
}
