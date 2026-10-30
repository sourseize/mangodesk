import { useMemo, useState } from "react";
import type { ActivityEntry } from "../domain/workspace";

interface ActivityFeedProps {
  entries: ActivityEntry[];
}

type ActivityFilter = "all" | ActivityEntry["kind"];

const activityCopy = {
  created: "added",
  started: "started",
  completed: "wrapped up",
  reopened: "reopened",
};

export function ActivityFeed({ entries }: ActivityFeedProps) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const [filter, setFilter] = useState<ActivityFilter>("all");
  const [query, setQuery] = useState("");
  const sortedEntries = useMemo(
    () => [...entries].sort((first, second) =>
      new Date(second.occurredAt).getTime() - new Date(first.occurredAt).getTime(),
    ),
    [entries],
  );
  const visibleEntries = sortedEntries.filter((entry) =>
    (filter === "all" || entry.kind === filter) &&
    entry.itemTitle.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
  );
  const displayedEntries = historyOpen ? visibleEntries : sortedEntries.slice(0, 5);

  return (
    <section className="activity-card">
      <div className="section-heading">
        <div>
          <p className="eyebrow">THE PAPER TRAIL</p>
          <h2>{historyOpen ? "Activity history" : "Latest moves"}</h2>
        </div>
        <span className="activity-count">{entries.length.toString().padStart(2, "0")}</span>
      </div>
      {historyOpen && (
        <div className="history-tools">
          <label className="sr-only" htmlFor="history-search">Search activity history</label>
          <input
            id="history-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Find an activity..."
          />
          <label className="sr-only" htmlFor="history-filter">Filter activity type</label>
          <select
            id="history-filter"
            value={filter}
            onChange={(event) => setFilter(event.target.value as ActivityFilter)}
          >
            <option value="all">All activity</option>
            <option value="created">Added</option>
            <option value="started">Started</option>
            <option value="completed">Wrapped up</option>
            <option value="reopened">Reopened</option>
          </select>
        </div>
      )}
      {entries.length === 0 ? (
        <p className="activity-empty">Your story starts with the first small win.</p>
      ) : displayedEntries.length === 0 ? (
        <p className="activity-empty">No activity matches those filters.</p>
      ) : (
        <ol className="activity-list">
          {displayedEntries.map((entry) => (
            <li key={entry.id}>
              <span className={`activity-dot dot-${entry.kind}`} aria-hidden="true" />
              <div>
                <p><strong>{activityCopy[entry.kind]}</strong> {entry.itemTitle}</p>
                <time dateTime={entry.occurredAt}>{formatTime(entry.occurredAt, historyOpen)}</time>
              </div>
            </li>
          ))}
        </ol>
      )}
      {entries.length > 5 && (
        <button
          className="history-toggle"
          type="button"
          onClick={() => setHistoryOpen((open) => !open)}
          aria-expanded={historyOpen}
        >
          {historyOpen ? "Show latest" : `View all ${entries.length} activities`}
          <span aria-hidden="true">{historyOpen ? "↑" : "↗"}</span>
        </button>
      )}
      <div className="local-note"><span aria-hidden="true">◈</span> Saved on this device. Always.</div>
    </section>
  );
}

function formatTime(value: string, includeDate: boolean): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "just now";
  return new Intl.DateTimeFormat(
    undefined,
    includeDate
      ? { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }
      : { hour: "numeric", minute: "2-digit" },
  ).format(date);
}
