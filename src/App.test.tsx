import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import App from "./App";
import { generateSeedWorkspace } from "./devtools/seedData";
import { installFakeServer } from "./test/fakeServer";

/** Renders the app against a fake server and waits for the workspace to load. */
async function renderApp(...args: Parameters<typeof installFakeServer>) {
  const server = installFakeServer(...args);
  const utils = render(<App />);
  await screen.findByRole("heading", { name: /Your task list/ });
  return { ...utils, server };
}

describe("App", () => {
  it("shows a loading state, then the workspace from the server", async () => {
    installFakeServer();
    render(<App />);
    expect(screen.getByRole("status")).toHaveTextContent("Setting the desk…");

    expect(await screen.findByRole("heading", { name: /Your task list/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/Make today\s*count\./);
    expect(screen.getAllByRole("listitem").length).toBeGreaterThan(0);
    expect(screen.getByText("LOCAL SERVER")).toBeInTheDocument();
  });

  it("explains when the server cannot be reached and can retry", async () => {
    const user = userEvent.setup();
    const server = installFakeServer();
    server.failNext(1);
    render(<App />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Can’t reach your desk.");
    expect(screen.getByText("OFFLINE")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("heading", { name: /Your task list/ })).toBeInTheDocument();
  });

  it("keeps the desk and shows a notice when a change is rejected", async () => {
    const user = userEvent.setup();
    const { server } = await renderApp();

    server.failNext(1);
    await user.click(screen.getByRole("button", { name: "Complete Sketch out the week’s big rocks" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("That change didn’t go through");
    expect(screen.getByRole("button", { name: "Complete Sketch out the week’s big rocks" })).toBeInTheDocument();
  });

  it("adds a task from the composer and logs it in the activity feed", async () => {
    const user = userEvent.setup();
    await renderApp();

    await user.type(screen.getByLabelText("What needs your attention?"), "Water the plants");
    await user.selectOptions(screen.getByLabelText("Task priority"), "High");
    await user.click(screen.getByRole("button", { name: /Add task/ }));

    expect(await within(screen.getByRole("heading", { name: /Your task list/ }).closest("section")!).findByText("Water the plants")).toBeInTheDocument();
    const feed = screen.getByRole("heading", { name: "Latest moves" }).closest("section")!;
    expect(within(feed).getAllByRole("listitem")[0]).toHaveTextContent("added Water the plants");
    expect(screen.getByLabelText("What needs your attention?")).toHaveValue("");
  });

  it("completes and reopens a task from the list", async () => {
    const user = userEvent.setup();
    await renderApp();

    await user.click(screen.getByRole("button", { name: "Complete Sketch out the week’s big rocks" }));
    expect(await screen.findByRole("button", { name: "Reopen Sketch out the week’s big rocks" })).toHaveAttribute("aria-pressed", "true");

    await user.click(screen.getByRole("button", { name: "Reopen Sketch out the week’s big rocks" }));
    expect(await screen.findByRole("button", { name: "Complete Sketch out the week’s big rocks" })).toHaveAttribute("aria-pressed", "false");
  });

  it("filters the list by workstream", async () => {
    const user = userEvent.setup();
    await renderApp();

    await user.click(screen.getByRole("button", { name: "Studio 1" }));
    expect(screen.getByRole("heading", { name: /Studio/ })).toBeInTheDocument();
    expect(screen.queryByText("Sketch out the week’s big rocks")).not.toBeInTheDocument();
    expect(screen.getByText("Collect the loose ideas in one place")).toBeInTheDocument();
  });

  it("switches to the board and moves a card between columns", async () => {
    const user = userEvent.setup();
    await renderApp();

    await user.click(screen.getByRole("button", { name: /Board/ }));
    const upNext = screen.getByLabelText("Up next tasks");
    const inMotion = screen.getByLabelText("In motion tasks");
    expect(within(upNext).getByText("Sketch out the week’s big rocks")).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Move Sketch out the week’s big rocks"), "doing");
    expect(await within(inMotion).findByText("Sketch out the week’s big rocks")).toBeInTheDocument();
    expect(screen.getByText("started").closest("p")).toHaveTextContent("started Sketch out the week’s big rocks");
  });

  it("creates a workstream and can pause it", async () => {
    const user = userEvent.setup();
    await renderApp();

    await user.click(screen.getByRole("button", { name: /New stream/ }));
    await user.type(screen.getByLabelText("Workstream name"), "Garden");
    await user.click(screen.getByRole("button", { name: "Create" }));
    expect(await screen.findByRole("button", { name: "Garden 0" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Pause Garden" }));
    expect(await screen.findByRole("button", { name: "Activate Garden" })).toBeInTheDocument();
  });
});

describe("App with server-seeded data", () => {
  it("shows whatever the server holds and pages long lists", async () => {
    const user = userEvent.setup();
    const seeded = generateSeedWorkspace({ seed: 5, items: 45, workstreams: 4, days: 10, now: Date.now() });
    await renderApp(seeded);

    expect(screen.getByRole("heading", { name: /Workstreams/ })).toHaveTextContent("4");
    expect(screen.getByRole("heading", { name: /Your task list/ })).toHaveTextContent("45");
    expect(screen.getAllByRole("listitem").filter((row) => row.classList.contains("task-row"))).toHaveLength(20);
    expect(screen.getByRole("navigation", { name: "tasks pages" })).toHaveTextContent("1–20 of 45 tasks");

    await user.click(within(screen.getByRole("navigation", { name: "tasks pages" })).getByRole("button", { name: "Next page" }));
    await user.click(within(screen.getByRole("navigation", { name: "tasks pages" })).getByRole("button", { name: "Next page" }));
    expect(screen.getByRole("navigation", { name: "tasks pages" })).toHaveTextContent("41–45 of 45 tasks");
    expect(screen.getAllByRole("listitem").filter((row) => row.classList.contains("task-row"))).toHaveLength(5);
  });
});

describe("App summary and priority controls", () => {
  it("summarises status and open priorities in the strip", async () => {
    await renderApp();
    const strip = screen.getByRole("region", { name: "Today at a glance" });
    expect(strip).toHaveTextContent("01UP NEXT");
    expect(strip).toHaveTextContent("01IN MOTION");
    expect(strip).toHaveTextContent("01ALREADY DONE");
    const priorities = within(strip).getByLabelText("Open tasks by priority");
    expect(priorities).toHaveTextContent("High 1");
    expect(priorities).toHaveTextContent("Normal 1");
    expect(priorities).toHaveTextContent("Low 0");
  });

  it("filters and sorts the list by priority", async () => {
    const user = userEvent.setup();
    await renderApp();
    const titles = () => screen.getAllByRole("listitem")
      .filter((row) => row.classList.contains("task-row"))
      .map((row) => row.querySelector(".task-title")?.textContent);

    expect(titles()).toEqual(["Sketch out the week’s big rocks", "Collect the loose ideas in one place", "Take a real lunch break"]);

    await user.selectOptions(screen.getByLabelText("Sort"), "oldest");
    expect(titles()).toEqual(["Sketch out the week’s big rocks", "Collect the loose ideas in one place", "Take a real lunch break"]);
    await user.selectOptions(screen.getByLabelText("Sort"), "newest");
    expect(titles()).toEqual(["Take a real lunch break", "Collect the loose ideas in one place", "Sketch out the week’s big rocks"]);

    await user.selectOptions(screen.getByLabelText("Priority"), "Low");
    expect(titles()).toEqual(["Take a real lunch break"]);
    expect(screen.getByRole("group", { name: "Filter and sort tasks" })).toHaveTextContent("1 of 3 tasks");

    await user.click(screen.getByRole("button", { name: /Board/ }));
    expect(screen.getByRole("group", { name: "Filter and sort tasks" })).toBeInTheDocument();
    expect(within(screen.getByLabelText("Done tasks")).getByText("Take a real lunch break")).toBeInTheDocument();
    expect(within(screen.getByLabelText("Up next tasks")).queryByText("Sketch out the week’s big rocks")).not.toBeInTheDocument();
  });
});

describe("App history view", () => {
  it("opens the full history from the sidebar and records workstream actions", async () => {
    const user = userEvent.setup();
    await renderApp();

    await user.click(screen.getByRole("button", { name: "Pause Studio" }));
    await screen.findByRole("button", { name: "Activate Studio" });
    await user.click(screen.getByRole("button", { name: /View full history/ }));

    expect(screen.getByRole("heading", { name: /Activity history/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /History/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByLabelText("What needs your attention?")).not.toBeInTheDocument();

    const rows = screen.getAllByRole("row").filter((row) => row.querySelector("td"));
    expect(rows[0]).toHaveTextContent("Workstream paused");
    expect(rows[0]).toHaveTextContent("Studio");
    expect(rows[0]).toHaveTextContent("Active → Paused");
  });

  it("scopes the history to the selected workstream", async () => {
    const user = userEvent.setup();
    await renderApp();

    await user.type(screen.getByLabelText("What needs your attention?"), "Studio task");
    await user.selectOptions(screen.getByLabelText("Task workstream"), "studio");
    await user.click(screen.getByRole("button", { name: /Add task/ }));

    await user.click(await screen.findByRole("button", { name: "Studio 2" }));
    await user.click(screen.getByRole("button", { name: /History/ }));

    expect(screen.getByRole("heading", { name: /Studio history/ })).toBeInTheDocument();
    const rows = screen.getAllByRole("row").filter((row) => row.querySelector("td"));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent("Studio task");
  });
});

describe("App focus queue", () => {
  it("queues from the list, reorders in the Queue tab and drops completed work", async () => {
    const user = userEvent.setup();
    const { server } = await renderApp();

    // Starter queue holds two tasks; queue the third open one from the list? It is done — reopen it first.
    expect(screen.getByRole("button", { name: /Queue/ })).toHaveTextContent("2");
    await user.click(screen.getByRole("button", { name: "Reopen Take a real lunch break" }));
    await user.click(await screen.findByRole("button", { name: "Add Take a real lunch break to the queue" }));
    expect(await screen.findByRole("button", { name: "Remove Take a real lunch break from the queue" })).toHaveAttribute("aria-pressed", "true");
    expect(server.workspace.focusQueue).toEqual(["welcome-plan", "welcome-ideas", "welcome-coffee"]);

    await user.click(screen.getByRole("button", { name: /Queue/ }));
    expect(screen.getByRole("heading", { name: /Focus queue/ })).toHaveTextContent("3");
    const rows = () => within(screen.getByRole("list", { name: "Focus queue" })).getAllByRole("listitem")
      .map((row) => row.getAttribute("aria-label"));
    expect(rows()).toEqual([
      "1 of 3: Sketch out the week’s big rocks",
      "2 of 3: Collect the loose ideas in one place",
      "3 of 3: Take a real lunch break",
    ]);

    fireEvent.keyDown(screen.getByRole("listitem", { name: /Take a real lunch break$/ }), { key: "U" });
    expect(rows()[0]).toBe("1 of 3: Take a real lunch break");
    await waitFor(() => expect(server.workspace.focusQueue).toEqual(["welcome-coffee", "welcome-plan", "welcome-ideas"]));
    expect(server.workspace.activity[0]).toMatchObject({ action: "queue.moved", from: "3", to: "1" });

    await user.click(screen.getByRole("button", { name: "Complete Take a real lunch break" }));
    await waitFor(() => expect(rows()).toHaveLength(2));
    expect(server.workspace.focusQueue).toEqual(["welcome-plan", "welcome-ideas"]);

    await user.click(screen.getByRole("button", { name: /History/ }));
    const history = screen.getAllByRole("row").filter((row) => row.querySelector("td"));
    expect(history[0]).toHaveTextContent("Removed from queue");
    expect(history[0]).toHaveTextContent("was #1");
    expect(history[2]).toHaveTextContent("Queue reordered");
    expect(history[2]).toHaveTextContent("#3 → #1");
  });
});
