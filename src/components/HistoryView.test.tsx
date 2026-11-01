import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { generateSeedWorkspace } from "../devtools/seedData";
import type { ActivityEntry, Workstream } from "../domain/workspace";
import { HistoryView } from "./HistoryView";

const NOW = new Date(2026, 2, 10, 15, 0, 0);
const at = (day: number, hour = 9) => new Date(2026, 2, day, hour, 0, 0).toISOString();

const workstreams: Workstream[] = [
  { id: "a", name: "Alpha", color: "mango", status: "active" },
  { id: "b", name: "Finance", color: "leaf", status: "paused" },
];

const entries: ActivityEntry[] = [
  { id: "1", occurredAt: at(10, 14), action: "task.status_changed", entityType: "task", entityId: "t1", title: "Write the report", workstreamId: "a", priority: "High", from: "doing", to: "done" },
  { id: "2", occurredAt: at(10, 8), action: "task.created", entityType: "task", entityId: "t2", title: "Call the bank", workstreamId: "b", priority: "Low" },
  { id: "3", occurredAt: at(9), action: "workstream.paused", entityType: "workstream", entityId: "b", title: "Finance", from: "active", to: "paused" },
  { id: "4", occurredAt: at(1), action: "workstream.created", entityType: "workstream", entityId: "a", title: "Alpha" },
];

function renderView(props: Partial<Parameters<typeof HistoryView>[0]> = {}) {
  const download = vi.fn();
  const utils = render(<HistoryView entries={entries} workstreams={workstreams} now={() => NOW} download={download} {...props} />);
  return { ...utils, download };
}

describe("HistoryView", () => {
  it("renders a day-grouped audit table with action, change and workstream columns", () => {
    renderView();

    expect(screen.getByRole("status")).toHaveTextContent("Showing 1–4 of 4 events");
    const today = screen.getByRole("region", { name: "Today" });
    const rows = within(today).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent("Task status changed");
    expect(rows[0]).toHaveTextContent("Write the report");
    expect(rows[0]).toHaveTextContent("In motion → Done");
    expect(rows[0]).toHaveTextContent("High");
    expect(rows[0]).toHaveTextContent("Alpha");
    expect(rows[1]).toHaveTextContent("Task added");
    expect(rows[1]).toHaveTextContent("Finance");

    const yesterday = screen.getByRole("region", { name: "Yesterday" });
    expect(within(yesterday).getAllByRole("row")[1]).toHaveTextContent("Workstream paused");
    expect(within(yesterday).getAllByRole("row")[1]).toHaveTextContent("Active → Paused");
    expect(screen.getByRole("region", { name: "Sunday, March 1" })).toBeInTheDocument();
    expect(screen.getByText(/Keeps the most recent 1,000 events/)).toBeInTheDocument();
  });

  it("filters by search, action and dates, and can clear them", async () => {
    const user = userEvent.setup();
    renderView();

    await user.type(screen.getByLabelText("Search activity history"), "bank");
    expect(screen.getByRole("status")).toHaveTextContent("Showing 1–1 of 1 event (4 total)");
    expect(screen.getByText("Call the bank")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(screen.getByRole("status")).toHaveTextContent("Showing 1–4 of 4 events");

    await user.selectOptions(screen.getByLabelText("Filter by action"), "workstream");
    expect(screen.getByRole("status")).toHaveTextContent("Showing 1–2 of 2 events (4 total)");

    await user.selectOptions(screen.getByLabelText("Filter by action"), "all");
    const from = screen.getByLabelText("From");
    await user.clear(from);
    await user.type(from, "2026-03-10");
    expect(screen.getByRole("status")).toHaveTextContent("Showing 1–2 of 2 events (4 total)");
    expect(screen.queryByRole("region", { name: "Yesterday" })).not.toBeInTheDocument();
  });

  it("filters by the task priority recorded on the entry", async () => {
    const user = userEvent.setup();
    renderView();
    await user.selectOptions(screen.getByLabelText("Filter by priority"), "Low");
    expect(screen.getByRole("status")).toHaveTextContent("Showing 1–1 of 1 event (4 total)");
    expect(screen.getByText("Call the bank")).toBeInTheDocument();
    expect(screen.queryByText("Write the report")).not.toBeInTheDocument();
  });

  it("shows an empty state when nothing matches", async () => {
    const user = userEvent.setup();
    renderView();
    await user.type(screen.getByLabelText("Search activity history"), "zzz");
    expect(screen.getByText("No activity matches those filters.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Export JSON/ })).toBeDisabled();
  });

  it("shows an empty state when there is no history at all", () => {
    renderView({ entries: [] });
    expect(screen.getByText("Nothing in the history yet.")).toBeInTheDocument();
  });

  it("exports the filtered entries as JSON", async () => {
    const user = userEvent.setup();
    const { download } = renderView();

    await user.selectOptions(screen.getByLabelText("Filter by action"), "task.created");
    await user.click(screen.getByRole("button", { name: /Export JSON/ }));

    expect(download).toHaveBeenCalledOnce();
    const [filename, contents] = download.mock.calls[0];
    expect(filename).toBe("mango-desk-history-2026-03-10.json");
    const payload = JSON.parse(contents);
    expect(payload).toMatchObject({ app: "mango-desk", format: 1, count: 1, filters: { action: "task.created" } });
    expect(payload.entries).toEqual([entries[1]]);
  });

  it("pages long histories 50 at a time and resets to page 1 when filters change", async () => {
    const user = userEvent.setup();
    const seeded = generateSeedWorkspace({ seed: 1, items: 80, workstreams: 3, days: 30, now: NOW.getTime() });
    renderView({ entries: seeded.activity, workstreams: seeded.workstreams });

    const total = seeded.activity.length;
    expect(total).toBeGreaterThan(100);
    expect(screen.getByRole("status")).toHaveTextContent(`Showing 1–50 of ${total} events`);
    expect(screen.getAllByRole("row").filter((row) => row.querySelector("td"))).toHaveLength(50);

    await user.click(screen.getByRole("button", { name: "Next page" }));
    expect(screen.getByRole("status")).toHaveTextContent(`Showing 51–100 of ${total} events`);

    await user.selectOptions(screen.getByLabelText("Filter by action"), "workstream");
    expect(screen.getByRole("status")).toHaveTextContent(/Showing 1–\d+ of \d+ events/);
  });
});
