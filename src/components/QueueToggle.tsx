import type { WorkItem } from "../domain/workspace";

interface QueueToggleProps {
  item: WorkItem;
  queued: boolean;
  onToggle: (itemId: string, queued: boolean) => void;
}

/** Adds an open task to the focus queue, or takes it out again. */
export function QueueToggle({ item, queued, onToggle }: QueueToggleProps) {
  return (
    <button
      type="button"
      className={`queue-toggle${queued ? " is-queued" : ""}`}
      onClick={() => onToggle(item.id, !queued)}
      aria-pressed={queued}
      aria-label={queued ? `Remove ${item.title} from the queue` : `Add ${item.title} to the queue`}
      title={queued ? "In the focus queue — click to remove" : "Add to the focus queue"}
    >
      <span aria-hidden="true">{queued ? "≡" : "+"}</span>
      <span className="queue-toggle-text">{queued ? "Queued" : "Queue"}</span>
    </button>
  );
}
