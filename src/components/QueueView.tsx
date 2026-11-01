import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { WorkItem, Workstream } from "../domain/workspace";

interface QueueViewProps {
  /** Queued tasks in queue order. */
  items: WorkItem[];
  /** Open tasks that are not queued yet. */
  candidates: WorkItem[];
  workstreams: Workstream[];
  onMove: (itemId: string, toIndex: number) => void;
  onRemove: (itemId: string) => void;
  onAdd: (itemId: string) => void;
  onStart: (itemId: string) => void;
  onComplete: (itemId: string) => void;
}

/** Queue position a task should move to for a keyboard or drag gesture. */
export function targetIndex(ids: string[], itemId: string, gesture: "up" | "down" | "top" | "bottom"): number | null {
  const from = ids.indexOf(itemId);
  if (from === -1) return null;
  const to = { up: from - 1, down: from + 1, top: 0, bottom: ids.length - 1 }[gesture];
  return to < 0 || to >= ids.length || to === from ? null : to;
}

export function QueueView({ items, candidates, workstreams, onMove, onRemove, onAdd, onStart, onComplete }: QueueViewProps) {
  const ids = items.map((item) => item.id);
  const [announcement, setAnnouncement] = useState("");
  const [pendingFocus, setPendingFocus] = useState<string | null>(null);
  const [candidateId, setCandidateId] = useState("");
  const rowRefs = useRef(new Map<string, HTMLLIElement>());
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // After a keyboard move the row re-renders in its new place; put focus back on it.
  useEffect(() => {
    if (pendingFocus) {
      rowRefs.current.get(pendingFocus)?.focus();
      setPendingFocus(null);
    }
  }, [pendingFocus, ids.join("|")]);

  function move(item: WorkItem, gesture: "up" | "down" | "top" | "bottom") {
    const to = targetIndex(ids, item.id, gesture);
    if (to === null) {
      setAnnouncement(`${item.title} is already at the ${gesture === "up" || gesture === "top" ? "top" : "bottom"}.`);
      return;
    }
    onMove(item.id, to);
    setAnnouncement(`Moved ${item.title} to position ${to + 1} of ${ids.length}.`);
    setPendingFocus(item.id);
  }

  function remove(item: WorkItem, index: number) {
    onRemove(item.id);
    setAnnouncement(`Removed ${item.title} from the queue.`);
    const neighbour = items[index + 1] ?? items[index - 1];
    if (neighbour) setPendingFocus(neighbour.id);
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const to = ids.indexOf(String(over.id));
    const item = items.find((candidate) => candidate.id === active.id);
    if (to === -1 || !item) return;
    onMove(item.id, to);
    setAnnouncement(`Moved ${item.title} to position ${to + 1} of ${ids.length}.`);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLLIElement>, item: WorkItem, index: number) {
    if (event.target !== event.currentTarget) return; // let buttons and inputs keep their keys
    const key = event.key;
    const handled = () => event.preventDefault();
    if (key === "u" || key === "ArrowUp" && event.altKey) { handled(); move(item, "up"); }
    else if (key === "d" || key === "ArrowDown" && event.altKey) { handled(); move(item, "down"); }
    else if (key === "U") { handled(); move(item, "top"); }
    else if (key === "D") { handled(); move(item, "bottom"); }
    else if (key === "ArrowDown" || key === "j") { handled(); rowRefs.current.get(ids[index + 1] ?? "")?.focus(); }
    else if (key === "ArrowUp" || key === "k") { handled(); rowRefs.current.get(ids[index - 1] ?? "")?.focus(); }
    else if (key === "Home") { handled(); rowRefs.current.get(ids[0])?.focus(); }
    else if (key === "End") { handled(); rowRefs.current.get(ids[ids.length - 1])?.focus(); }
    else if (key === "Delete" || key === "Backspace" || key === "x") { handled(); remove(item, index); }
    else if (key === "Enter") { handled(); onStart(item.id); setAnnouncement(`Started ${item.title}.`); }
    else if (key === " ") { handled(); onComplete(item.id); setAnnouncement(`Completed ${item.title}.`); }
  }

  return (
    <div className="queue">
      <form
        className="queue-add"
        onSubmit={(event) => {
          event.preventDefault();
          if (!candidateId) return;
          const item = candidates.find((candidate) => candidate.id === candidateId);
          onAdd(candidateId);
          setCandidateId("");
          if (item) setAnnouncement(`Added ${item.title} to the queue.`);
        }}
      >
        <label className="sr-only" htmlFor="queue-candidate">Task to add to the queue</label>
        <select id="queue-candidate" value={candidateId} onChange={(event) => setCandidateId(event.target.value)}>
          <option value="">{candidates.length === 0 ? "Every open task is queued" : "Pick a task to line up…"}</option>
          {candidates.map((item) => (
            <option key={item.id} value={item.id}>{item.title} · {item.priority}</option>
          ))}
        </select>
        <button type="submit" disabled={!candidateId}>Add to queue</button>
      </form>

      <p className="sr-only" role="status" aria-live="polite" aria-label="Queue updates">{announcement}</p>

      {items.length === 0 ? (
        <div className="empty-state">
          <span aria-hidden="true">✳</span>
          <strong>Your queue is empty.</strong>
          <p>Line up what you’ll do next — from the list, the board, or the picker above.</p>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={ids} strategy={verticalListSortingStrategy}>
            <ol className="queue-list" aria-label="Focus queue">
              {items.map((item, index) => (
                <QueueRow
                  key={item.id}
                  item={item}
                  index={index}
                  count={items.length}
                  workstream={workstreams.find((candidate) => candidate.id === item.workstreamId)}
                  rowRef={(node) => {
                    if (node) rowRefs.current.set(item.id, node);
                    else rowRefs.current.delete(item.id);
                  }}
                  onKeyDown={(event) => handleKeyDown(event, item, index)}
                  onMoveUp={() => move(item, "up")}
                  onMoveDown={() => move(item, "down")}
                  onRemove={() => remove(item, index)}
                  onStart={() => onStart(item.id)}
                  onComplete={() => onComplete(item.id)}
                />
              ))}
            </ol>
          </SortableContext>
        </DndContext>
      )}

      <p className="queue-help">
        <span>Drag the handle, or focus a row and press</span>
        <kbd>u</kbd> / <kbd>d</kbd> move · <kbd>U</kbd> / <kbd>D</kbd> top / bottom ·
        <kbd>↑</kbd> / <kbd>↓</kbd> navigate · <kbd>Enter</kbd> start · <kbd>Space</kbd> complete · <kbd>Del</kbd> remove
      </p>
    </div>
  );
}

interface QueueRowProps {
  item: WorkItem;
  index: number;
  count: number;
  workstream?: Workstream;
  rowRef: (node: HTMLLIElement | null) => void;
  onKeyDown: (event: KeyboardEvent<HTMLLIElement>) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
  onStart: () => void;
  onComplete: () => void;
}

function QueueRow({ item, index, count, workstream, rowRef, onKeyDown, onMoveUp, onMoveDown, onRemove, onStart, onComplete }: QueueRowProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <li
      ref={(node) => {
        setNodeRef(node);
        rowRef(node);
      }}
      style={style}
      className={`queue-row${index === 0 ? " is-up-now" : ""}${item.status === "doing" ? " is-doing" : ""}${isDragging ? " is-dragging" : ""}`}
      tabIndex={0}
      onKeyDown={onKeyDown}
      aria-label={`${index + 1} of ${count}: ${item.title}`}
    >
      <button
        type="button"
        className="queue-handle"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label={`Drag to reorder ${item.title}`}
        title="Drag to reorder"
      >
        ⠿
      </button>
      <span className="queue-position" aria-hidden="true">{index + 1}</span>
      <div className="queue-body">
        <span className="queue-title">{item.title}</span>
        <span className="queue-meta">
          {index === 0 && <span className="queue-up-now">UP NOW</span>}
          {item.status === "doing" && <span className="task-state">IN MOTION</span>}
          {workstream && <span className={`board-workstream stream-${workstream.color}`}><i aria-hidden="true" />{workstream.name}</span>}
          <span className={`priority priority-${item.priority.toLowerCase()}`}><span aria-hidden="true">●</span> {item.priority}</span>
        </span>
      </div>
      <div className="queue-actions">
        {item.status !== "doing" && (
          <button type="button" onClick={onStart} aria-label={`Start ${item.title}`} title="Start (Enter)">▶</button>
        )}
        <button type="button" onClick={onComplete} aria-label={`Complete ${item.title}`} title="Complete (Space)">✓</button>
        <button type="button" onClick={onMoveUp} disabled={index === 0} aria-label={`Move ${item.title} up`} title="Move up (u)">↑</button>
        <button type="button" onClick={onMoveDown} disabled={index === count - 1} aria-label={`Move ${item.title} down`} title="Move down (d)">↓</button>
        <button type="button" onClick={onRemove} aria-label={`Remove ${item.title} from the queue`} title="Remove (Delete)">✕</button>
      </div>
    </li>
  );
}
