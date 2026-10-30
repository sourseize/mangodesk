import { useState, type FormEvent } from "react";
import {
  workstreamColors,
  type Workstream,
  type WorkstreamColor,
} from "../domain/workspace";

interface WorkstreamBarProps {
  workstreams: Workstream[];
  itemCounts: Record<string, number>;
  selectedId: string | null;
  onSelect: (workstreamId: string | null) => void;
  onAdd: (name: string, color: WorkstreamColor) => void;
  onToggleStatus: (workstreamId: string) => void;
}

export function WorkstreamBar({
  workstreams,
  itemCounts,
  selectedId,
  onSelect,
  onAdd,
  onToggleStatus,
}: WorkstreamBarProps) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState<WorkstreamColor>("coral");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onAdd(trimmed, color);
    setName("");
    setCreating(false);
  }

  return (
    <section className="workstreams" aria-label="Workstreams">
      <div className="workstreams-heading">
        <div>
          <p className="eyebrow">KEEP IT IN ITS LANE</p>
          <h2>Workstreams <span>{workstreams.length}</span></h2>
        </div>
        <button className="new-stream-button" type="button" onClick={() => setCreating((value) => !value)}>
          {creating ? "Cancel" : "＋ New stream"}
        </button>
      </div>
      <div className="stream-list">
        <button
          className={`stream-chip stream-all${selectedId === null ? " selected" : ""}`}
          type="button"
          onClick={() => onSelect(null)}
          aria-pressed={selectedId === null}
        >
          <span className="stream-marker" aria-hidden="true">✳</span>
          <span className="stream-name">Everything</span>
          <span className="stream-count">{Object.values(itemCounts).reduce((sum, count) => sum + count, 0)}</span>
        </button>
        {workstreams.map((workstream) => (
          <div
            className={`stream-chip stream-${workstream.color}${selectedId === workstream.id ? " selected" : ""}${workstream.status === "paused" ? " paused" : ""}`}
            key={workstream.id}
          >
            <button
              className="stream-select"
              type="button"
              onClick={() => onSelect(workstream.id)}
              aria-pressed={selectedId === workstream.id}
            >
              <span className="stream-marker" aria-hidden="true" />
              <span className="stream-name">{workstream.name}</span>
              <span className="stream-count">{itemCounts[workstream.id] ?? 0}</span>
            </button>
            <button
              className="stream-status"
              type="button"
              onClick={() => onToggleStatus(workstream.id)}
              aria-label={`${workstream.status === "active" ? "Pause" : "Activate"} ${workstream.name}`}
              title={workstream.status === "active" ? "Pause workstream" : "Activate workstream"}
            >
              {workstream.status === "active" ? "●" : "Ⅱ"}
            </button>
          </div>
        ))}
      </div>
      {creating && (
        <form className="stream-create-form" onSubmit={handleSubmit}>
          <label className="sr-only" htmlFor="new-stream-name">Workstream name</label>
          <input
            id="new-stream-name"
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Name a new stream"
            maxLength={32}
          />
          <label className="sr-only" htmlFor="new-stream-color">Workstream color</label>
          <select
            id="new-stream-color"
            value={color}
            onChange={(event) => setColor(event.target.value as WorkstreamColor)}
          >
            {workstreamColors.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
          <button type="submit" disabled={!name.trim()}>Create</button>
        </form>
      )}
    </section>
  );
}
