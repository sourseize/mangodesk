import type { ActivityAction, ActivityEntry, Priority } from "./workspace.ts";

/** Pure helpers for the activity-history report: filtering, grouping, export. */

export type ActionFilter = "all" | "task" | "workstream" | ActivityAction;

export interface HistoryFilters {
  query: string;
  action: ActionFilter;
  /** Task priority at the time of the action; "all" disables the filter. */
  priority: "all" | Priority;
  /** Inclusive local-date bounds in YYYY-MM-DD form; empty string means unbounded. */
  from: string;
  to: string;
}

export const emptyFilters: HistoryFilters = { query: "", action: "all", priority: "all", from: "", to: "" };

export function filterActivity(entries: ActivityEntry[], filters: HistoryFilters): ActivityEntry[] {
  const query = filters.query.trim().toLocaleLowerCase();
  return entries.filter((entry) => {
    if (!matchesAction(entry, filters.action)) return false;
    if (filters.priority !== "all" && entry.priority !== filters.priority) return false;
    if (query && !entry.title.toLocaleLowerCase().includes(query)) return false;
    const day = localDateKey(entry.occurredAt);
    if (filters.from && day < filters.from) return false;
    if (filters.to && day > filters.to) return false;
    return true;
  });
}

function matchesAction(entry: ActivityEntry, filter: ActionFilter): boolean {
  if (filter === "all") return true;
  if (filter === "task" || filter === "workstream") return entry.entityType === filter;
  return entry.action === filter;
}

export interface DayGroup {
  key: string;
  label: string;
  entries: ActivityEntry[];
}

/** Groups entries (assumed newest first) by local calendar day. */
export function groupByDay(entries: ActivityEntry[], now: Date = new Date()): DayGroup[] {
  const groups: DayGroup[] = [];
  for (const entry of entries) {
    const key = localDateKey(entry.occurredAt);
    const last = groups[groups.length - 1];
    if (last && last.key === key) {
      last.entries.push(entry);
    } else {
      groups.push({ key, label: dayLabel(key, now), entries: [entry] });
    }
  }
  return groups;
}

/** YYYY-MM-DD in the user's local time zone; "" for unparseable dates. */
export function localDateKey(iso: string | Date): string {
  const date = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function dayLabel(key: string, now: Date): string {
  if (!key) return "Unknown date";
  if (key === localDateKey(now)) return "Today";
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (key === localDateKey(yesterday)) return "Yesterday";
  const [year, month, day] = key.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    ...(year !== now.getFullYear() ? { year: "numeric" } : {}),
  }).format(date);
}

export interface HistoryExport {
  app: "mango-desk";
  format: 1;
  exportedAt: string;
  filters: HistoryFilters;
  count: number;
  entries: ActivityEntry[];
}

export function buildHistoryExport(
  entries: ActivityEntry[],
  filters: HistoryFilters,
  now: Date = new Date(),
): HistoryExport {
  return { app: "mango-desk", format: 1, exportedAt: now.toISOString(), filters, count: entries.length, entries };
}

export function historyExportFilename(now: Date = new Date()): string {
  return `mango-desk-history-${localDateKey(now)}.json`;
}
