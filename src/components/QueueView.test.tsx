import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { WorkItem, Workstream } from "../domain/workspace";
import { QueueView, targetIndex } from "./QueueView";

const workstreams: Workstream[] = [{ id: "w", name: "Studio", color: "tomato", status: "active" }];
const task = (id: string, title: string, status: WorkItem["status"] = "todo"): WorkItem => ({
  id, title, status, priority: "Normal", workstreamId: "w", createdAt: "2026-01-01T00:00:00.000Z",
});
const queued = [task("a", "Alpha"), task("b", "Beta", "doing"), task("c", "Gamma")];
const candidates = [task("d", "Delta")];

function renderQueue(items = queued) {
  const handlers = { onMove: vi.fn(), onRemove: vi.fn(), onAdd: vi.fn(), onStart: vi.fn(), onComplete: vi.fn() };
  render(<QueueView items={items} candidates={candidates} workstreams={workstreams} {...handlers} />);
  return handlers;
}

const row = (title: string) => screen.getByRole("listitem", { name: new RegExp(`: ${title}$`) });

describe("targetIndex", () => {
  const ids = ["a", "b", "c"];
  it("computes the destination for each gesture and null at the edges", () => {
    expect(targetIndex(ids, "b", "up")).toBe(0);
    expect(targetIndex(ids, "b", "down")).toBe(2);
    expect(targetIndex(ids, "c", "top")).toBe(0);
    expect(targetIndex(ids, "a", "bottom")).toBe(2);
    expect(targetIndex(ids, "a", "up")).toBeNull();
    expect(targetIndex(ids, "c", "down")).toBeNull();
    expect(targetIndex(ids, "a", "top")).toBeNull();
    expect(targetIndex(ids, "zzz", "up")).toBeNull();
  });
});

describe("QueueView", () => {
  it("renders the queue in order with the first task marked as up now", () => {
    renderQueue();
    const rows = within(screen.getByRole("list", { name: "Focus queue" })).getAllByRole("listitem");
    expect(rows.map((item) => item.getAttribute("aria-label"))).toEqual(["1 of 3: Alpha", "2 of 3: Beta", "3 of 3: Gamma"]);
    expect(rows[0]).toHaveTextContent("UP NOW");
    expect(rows[1]).toHaveTextContent("IN MOTION");
    expect(within(rows[1]).queryByRole("button", { name: "Start Beta" })).not.toBeInTheDocument();
    expect(within(rows[0]).getByRole("button", { name: "Move Alpha up" })).toBeDisabled();
    expect(within(rows[2]).getByRole("button", { name: "Move Gamma down" })).toBeDisabled();
  });

  it("moves with u / d and Shift+U / Shift+D from a focused row and announces it", () => {
    const handlers = renderQueue();
    const beta = row("Beta");
    beta.focus();

    fireEvent.keyDown(beta, { key: "u" });
    expect(handlers.onMove).toHaveBeenLastCalledWith("b", 0);
    expect(screen.getByRole("status", { name: "Queue updates" })).toHaveTextContent("Moved Beta to position 1 of 3.");

    fireEvent.keyDown(beta, { key: "d" });
    expect(handlers.onMove).toHaveBeenLastCalledWith("b", 2);

    fireEvent.keyDown(beta, { key: "D" });
    expect(handlers.onMove).toHaveBeenLastCalledWith("b", 2);
    fireEvent.keyDown(beta, { key: "U" });
    expect(handlers.onMove).toHaveBeenLastCalledWith("b", 0);
    expect(handlers.onMove).toHaveBeenCalledTimes(4);
  });

  it("explains when a move is not possible instead of sending it", () => {
    const handlers = renderQueue();
    fireEvent.keyDown(row("Alpha"), { key: "u" });
    expect(handlers.onMove).not.toHaveBeenCalled();
    expect(screen.getByRole("status", { name: "Queue updates" })).toHaveTextContent("Alpha is already at the top.");
  });

  it("navigates between rows with arrows, j/k, Home and End", () => {
    renderQueue();
    row("Alpha").focus();
    fireEvent.keyDown(row("Alpha"), { key: "ArrowDown" });
    expect(row("Beta")).toHaveFocus();
    fireEvent.keyDown(row("Beta"), { key: "j" });
    expect(row("Gamma")).toHaveFocus();
    fireEvent.keyDown(row("Gamma"), { key: "k" });
    expect(row("Beta")).toHaveFocus();
    fireEvent.keyDown(row("Beta"), { key: "End" });
    expect(row("Gamma")).toHaveFocus();
    fireEvent.keyDown(row("Gamma"), { key: "Home" });
    expect(row("Alpha")).toHaveFocus();
  });

  it("removes, starts and completes from the keyboard", () => {
    const handlers = renderQueue();
    fireEvent.keyDown(row("Gamma"), { key: "Enter" });
    expect(handlers.onStart).toHaveBeenCalledWith("c");
    fireEvent.keyDown(row("Gamma"), { key: " " });
    expect(handlers.onComplete).toHaveBeenCalledWith("c");
    fireEvent.keyDown(row("Beta"), { key: "Delete" });
    expect(handlers.onRemove).toHaveBeenCalledWith("b");
    expect(screen.getByRole("status", { name: "Queue updates" })).toHaveTextContent("Removed Beta from the queue.");
    fireEvent.keyDown(row("Alpha"), { key: "x" });
    expect(handlers.onRemove).toHaveBeenCalledWith("a");
  });

  it("ignores shortcuts typed inside the row's own controls", () => {
    const handlers = renderQueue();
    fireEvent.keyDown(within(row("Beta")).getByRole("button", { name: "Move Beta up" }), { key: "u" });
    expect(handlers.onMove).not.toHaveBeenCalled();
  });

  it("offers the row buttons as a mouse alternative", async () => {
    const user = userEvent.setup();
    const handlers = renderQueue();
    await user.click(screen.getByRole("button", { name: "Move Beta down" }));
    expect(handlers.onMove).toHaveBeenCalledWith("b", 2);
    await user.click(screen.getByRole("button", { name: "Start Alpha" }));
    expect(handlers.onStart).toHaveBeenCalledWith("a");
    await user.click(screen.getByRole("button", { name: "Complete Gamma" }));
    expect(handlers.onComplete).toHaveBeenCalledWith("c");
    await user.click(screen.getByRole("button", { name: "Remove Gamma from the queue" }));
    expect(handlers.onRemove).toHaveBeenCalledWith("c");
    expect(screen.getByRole("button", { name: "Drag to reorder Alpha" })).toBeInTheDocument();
  });

  it("adds a task from the picker", async () => {
    const user = userEvent.setup();
    const handlers = renderQueue();
    const button = screen.getByRole("button", { name: "Add to queue" });
    expect(button).toBeDisabled();
    await user.selectOptions(screen.getByLabelText("Task to add to the queue"), "d");
    await user.click(button);
    expect(handlers.onAdd).toHaveBeenCalledWith("d");
    expect(screen.getByRole("status", { name: "Queue updates" })).toHaveTextContent("Added Delta to the queue.");
    expect(screen.getByLabelText("Task to add to the queue")).toHaveValue("");
  });

  it("shows an empty state", () => {
    renderQueue([]);
    expect(screen.getByText("Your queue is empty.")).toBeInTheDocument();
  });
});
