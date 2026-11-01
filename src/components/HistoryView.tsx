import { useMemo, useState } from "react";
import { actionLabels, describeChange } from "../domain/activityPresentation";
import {
  buildHistoryExport,
  emptyFilters,
  filterActivity,
  groupByDay,
  historyExportFilename,
  type ActionFilter,
  type HistoryFilters,
} from "../domain/activityHistory";
import { ACTIVITY_LIMIT, activityActions, priorities, type ActivityEntry, type Priority, type Workstream } from "../domain/workspace";
import { usePagination } from "../hooks/usePagination";
import { Pagination } from "./Pagination";

interface HistoryViewProps {
  entries: ActivityEntry[];
  workstreams: Workstream[];
  /** Injected for deterministic "Today"/"Yesterday" labels in tests. */
  now?: () => Date;
  /** Injected download hook; defaults to a browser file download. */
  download?: (filename: string, contents: string) => void;
}

export const HISTORY_PAGE_SIZE = 50;

export function HistoryView({ entries, workstreams, now = () => new Date(), download = downloadFile }: HistoryViewProps) {
  const [filters, setFilters] = useState<HistoryFilters>(emptyFilters);

  const sorted = useMemo(
    () => [...entries].sort((first, second) => second.occurredAt.localeCompare(first.occurredAt)),
    [entries],
  );
  const filtered = useMemo(() => filterActivity(sorted, filters), [sorted, filters]);
  const pagination = usePagination(filtered, HISTORY_PAGE_SIZE);
  const groups = useMemo(() => groupByDay(pagination.pageItems, now()), [pagination.pageItems, now]);
  const streamNames = useMemo(
    () => Object.fromEntries(workstreams.map((stream) => [stream.id, stream.name])),
    [workstreams],
  );
  const isFiltered = filters.query !== "" || filters.action !== "all" || filters.priority !== "all" || filters.from !== "" || filters.to !== "";

  function update<Key extends keyof HistoryFilters>(key: Key, value: HistoryFilters[Key]) {
    setFilters((current) => ({ ...current, [key]: value }));
    pagination.setPage(1);
  }

  function handleExport() {
    const payload = buildHistoryExport(filtered, filters, now());
    download(historyExportFilename(now()), JSON.stringify(payload, null, 2));
  }

  return (
    <div className="history">
      <div className="history-tools" role="search" aria-label="Filter activity history">
        <label className="sr-only" htmlFor="history-search">Search activity history</label>
        <input
          id="history-search"
          type="search"
          value={filters.query}
          onChange={(event) => update("query", event.target.value)}
          placeholder="Find by task or stream name..."
        />
        <label className="sr-only" htmlFor="history-action">Filter by action</label>
        <select id="history-action" value={filters.action} onChange={(event) => update("action", event.target.value as ActionFilter)}>
          <option value="all">All actions</option>
          <option value="task">All task actions</option>
          <option value="workstream">All workstream actions</option>
          {activityActions.map((action) => (
            <option key={action} value={action}>{actionLabels[action]}</option>
          ))}
        </select>
        <label className="sr-only" htmlFor="history-priority">Filter by priority</label>
        <select id="history-priority" value={filters.priority} onChange={(event) => update("priority", event.target.value as "all" | Priority)}>
          <option value="all">Any priority</option>
          {priorities.map((level) => <option key={level} value={level}>{level} priority</option>)}
        </select>
        <label className="history-date">
          <span>From</span>
          <input type="date" value={filters.from} max={filters.to || undefined} onChange={(event) => update("from", event.target.value)} />
        </label>
        <label className="history-date">
          <span>To</span>
          <input type="date" value={filters.to} min={filters.from || undefined} onChange={(event) => update("to", event.target.value)} />
        </label>
        {isFiltered && (
          <button type="button" className="history-reset" onClick={() => { setFilters(emptyFilters); pagination.setPage(1); }}>
            Clear filters
          </button>
        )}
      </div>

      <div className="history-summary">
        <span role="status">
          {filtered.length === 0
            ? "No events"
            : `Showing ${pagination.start}–${pagination.end} of ${filtered.length} ${filtered.length === 1 ? "event" : "events"}`}
          {isFiltered ? ` (${entries.length} total)` : ""}
        </span>
        <button type="button" className="history-export" onClick={handleExport} disabled={filtered.length === 0}>
          Export JSON <span aria-hidden="true">↓</span>
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <span aria-hidden="true">✳</span>
          <strong>{entries.length === 0 ? "Nothing in the history yet." : "No activity matches those filters."}</strong>
          <p>{entries.length === 0 ? "Every task you add or move will show up here." : "Try widening the dates or clearing the search."}</p>
        </div>
      ) : (
        groups.map((group) => (
          <section className="history-day" key={group.key} aria-label={group.label}>
            <h3>{group.label} <span>{group.entries.length}</span></h3>
            <table className="history-table">
              <thead>
                <tr>
                  <th scope="col">Time</th>
                  <th scope="col">Action</th>
                  <th scope="col">What</th>
                  <th scope="col">Priority</th>
                  <th scope="col">Change</th>
                  <th scope="col">Workstream</th>
                </tr>
              </thead>
              <tbody>
                {group.entries.map((entry) => (
                  <tr key={entry.id} className={`history-row entity-${entry.entityType}`}>
                    <td><time dateTime={entry.occurredAt}>{formatClock(entry.occurredAt)}</time></td>
                    <td><span className={`history-action action-${entry.action.replace(".", "-")}`}>{actionLabels[entry.action]}</span></td>
                    <td className="history-title">{entry.title}</td>
                    <td className="history-priority">
                      {entry.priority ? (
                        <span className={`priority priority-${entry.priority.toLowerCase()}`}><span aria-hidden="true">●</span> {entry.priority}</span>
                      ) : "—"}
                    </td>
                    <td className="history-change">{describeChange(entry) || "—"}</td>
                    <td className="history-stream">{streamName(entry, streamNames)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))
      )}

      <Pagination pagination={pagination} label="events" />

      <p className="history-note">Keeps the most recent {ACTIVITY_LIMIT.toLocaleString()} events. Stored on your local server.</p>
    </div>
  );
}

function streamName(entry: ActivityEntry, names: Record<string, string>): string {
  if (entry.entityType === "workstream") return entry.title;
  if (!entry.workstreamId) return "—";
  return names[entry.workstreamId] ?? "—";
}

function formatClock(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(date);
}

function downloadFile(filename: string, contents: string): void {
  const blob = new Blob([contents], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
