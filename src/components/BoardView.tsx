import type { WorkItem, WorkStatus, Workstream } from "../domain/workspace";
import { usePagination } from "../hooks/usePagination";
import { Pagination } from "./Pagination";
import { QueueToggle } from "./QueueToggle";

interface BoardViewProps {
  items: WorkItem[];
  workstreams: Workstream[];
  queuedIds: Set<string>;
  onMove: (itemId: string, status: WorkStatus) => void;
  onToggleQueue: (itemId: string, queued: boolean) => void;
}

const columns: { status: WorkStatus; title: string; accent: string }[] = [
  { status: "todo", title: "Up next", accent: "todo" },
  { status: "doing", title: "In motion", accent: "doing" },
  { status: "done", title: "Done", accent: "done" },
];

export const BOARD_PAGE_SIZE = 15;

export function BoardView({ items, workstreams, queuedIds, onMove, onToggleQueue }: BoardViewProps) {
  return (
    <div className="board-grid">
      {columns.map((column) => (
        <BoardColumn
          key={column.status}
          column={column}
          items={items.filter((item) => item.status === column.status)}
          workstreams={workstreams}
          queuedIds={queuedIds}
          onMove={onMove}
          onToggleQueue={onToggleQueue}
        />
      ))}
    </div>
  );
}

interface BoardColumnProps {
  column: (typeof columns)[number];
  items: WorkItem[];
  workstreams: Workstream[];
  queuedIds: Set<string>;
  onMove: BoardViewProps["onMove"];
  onToggleQueue: BoardViewProps["onToggleQueue"];
}

function BoardColumn({ column, items: columnItems, workstreams, queuedIds, onMove, onToggleQueue }: BoardColumnProps) {
  const pagination = usePagination(columnItems, BOARD_PAGE_SIZE);
  return (
          <section className={`board-column column-${column.accent}`} aria-label={`${column.title} tasks`}>
            <header className="board-column-heading">
              <span className="board-column-dot" aria-hidden="true" />
              <h3>{column.title}</h3>
              <span className="board-column-count">{columnItems.length.toString().padStart(2, "0")}</span>
            </header>
            {columnItems.length === 0 ? (
              <p className="board-empty">A little breathing room.</p>
            ) : (
              <ul className="board-cards">
                {pagination.pageItems.map((item) => {
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
                      {item.status !== "done" && (
                        <QueueToggle item={item} queued={queuedIds.has(item.id)} onToggle={onToggleQueue} />
                      )}
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
            <Pagination pagination={pagination} label={`${column.title} tasks`} compact />
          </section>
  );
}
