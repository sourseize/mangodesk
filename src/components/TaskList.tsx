import type { WorkItem } from "../domain/workspace";

interface TaskListProps {
  items: WorkItem[];
  onToggle: (itemId: string) => void;
}

export function TaskList({ items, onToggle }: TaskListProps) {
  if (items.length === 0) {
    return (
      <div className="empty-state">
        <span aria-hidden="true">✳</span>
        <strong>Nothing on your plate. Nice.</strong>
        <p>Add a task above whenever something comes to mind.</p>
      </div>
    );
  }

  const priorityOrder = { High: 0, Normal: 1, Low: 2 };
  const statusOrder = { todo: 0, doing: 1, done: 2 };
  const orderedItems = [...items].sort((first, second) =>
    statusOrder[first.status] - statusOrder[second.status] ||
    priorityOrder[first.priority] - priorityOrder[second.priority],
  );

  return (
    <ul className="task-list">
      {orderedItems.map((item) => (
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
          <span className={`priority priority-${item.priority.toLowerCase()}`}>
            <span aria-hidden="true">●</span> {item.priority}
          </span>
        </li>
      ))}
    </ul>
  );
}
