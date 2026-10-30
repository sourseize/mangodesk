import type { WorkItem, WorkStatus, Workstream } from "../domain/workspace";

interface BoardViewProps {
  items: WorkItem[];
  workstreams: Workstream[];
  onMove: (itemId: string, status: WorkStatus) => void;
}

const columns: { status: WorkStatus; title: string; accent: string }[] = [
  { status: "todo", title: "Up next", accent: "todo" },
  { status: "doing", title: "In motion", accent: "doing" },
  { status: "done", title: "Done", accent: "done" },
];

export function BoardView({ items, workstreams, onMove }: BoardViewProps) {
  return (
    <div className="board-grid">
      {columns.map((column) => {
        const columnItems = items.filter((item) => item.status === column.status);
        return (
          <section className={`board-column column-${column.accent}`} key={column.status} aria-label={`${column.title} tasks`}>
            <header className="board-column-heading">
              <span className="board-column-dot" aria-hidden="true" />
              <h3>{column.title}</h3>
              <span className="board-column-count">{columnItems.length.toString().padStart(2, "0")}</span>
            </header>
            {columnItems.length === 0 ? (
              <p className="board-empty">A little breathing room.</p>
            ) : (
              <ul className="board-cards">
                {columnItems.map((item) => {
                  const workstream = workstreams.find((candidate) => candidate.id === item.workstreamId);
                  return (
                    <li className="board-card" key={item.id}>
                      <p className="board-card-title">{item.title}</p>
                      <div className="board-card-meta">
                        {workstream && (
                          <span className={`board-workstream stream-${workstream.color}`}>
                            <i aria-hidden="true" />{workstream.name}
                          </span>
                        )}
                        <span className={`priority priority-${item.priority.toLowerCase()}`}>
                          <span aria-hidden="true">●</span> {item.priority}
                        </span>
                      </div>
                      <label className="sr-only" htmlFor={`move-${item.id}`}>Move {item.title}</label>
                      <select
                        id={`move-${item.id}`}
                        className="board-move"
                        value={item.status}
                        onChange={(event) => onMove(item.id, event.target.value as WorkStatus)}
                      >
                        <option value="todo">Move to Up next</option>
                        <option value="doing">Move to In motion</option>
                        <option value="done">Move to Done</option>
                      </select>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
