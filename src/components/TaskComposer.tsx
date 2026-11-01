import { useState, type FormEvent } from "react";
import type { Priority, Workstream } from "../domain/workspace";

interface TaskComposerProps {
  workstreams: Workstream[];
  onAdd: (title: string, priority: Priority, workstreamId: string) => void;
}

export function TaskComposer({ workstreams, onAdd }: TaskComposerProps) {
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<Priority>("Normal");
  const [workstreamId, setWorkstreamId] = useState(workstreams[0]?.id ?? "");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    onAdd(trimmed, priority, workstreamId);
    setTitle("");
    setPriority("Normal");
  }

  return (
    <form className="capture" onSubmit={handleSubmit}>
      <label className="sr-only" htmlFor="new-task">What needs your attention?</label>
      <span className="capture-mark" aria-hidden="true">＋</span>
      <input
        id="new-task"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="Add a task to your day..."
        maxLength={120}
      />
      <label className="sr-only" htmlFor="task-priority">Task priority</label>
      <select id="task-priority" value={priority} onChange={(event) => setPriority(event.target.value as Priority)}>
        <option>Low</option>
        <option>Normal</option>
        <option>High</option>
      </select>
      <label className="sr-only" htmlFor="task-workstream">Task workstream</label>
      <select
        id="task-workstream"
        value={workstreamId}
        onChange={(event) => setWorkstreamId(event.target.value)}
        aria-label="Task workstream"
      >
        {workstreams.map((workstream) => (
          <option key={workstream.id} value={workstream.id}>
            {workstream.name}{workstream.status === "paused" ? " (paused)" : ""}
          </option>
        ))}
      </select>
      <button className="capture-submit" type="submit">Add task <span aria-hidden="true">↗</span></button>
    </form>
  );
}
