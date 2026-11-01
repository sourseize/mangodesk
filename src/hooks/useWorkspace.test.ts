import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { initialWorkspace } from "../domain/workspace";
import { installFakeServer } from "../test/fakeServer";
import { LEGACY_STORAGE_KEYS, useWorkspace } from "./useWorkspace";

function ready(result: { current: ReturnType<typeof useWorkspace> }) {
  const { state } = result.current;
  if (state.status !== "ready") throw new Error(`expected ready, got ${state.status}`);
  return state.workspace;
}

describe("useWorkspace", () => {
  it("loads the workspace from the server", async () => {
    const server = installFakeServer();
    const { result } = renderHook(() => useWorkspace());

    expect(result.current.state.status).toBe("loading");
    await waitFor(() => expect(result.current.state.status).toBe("ready"));
    expect(ready(result)).toEqual(initialWorkspace);
    expect(server.calls).toEqual([{ method: "GET", url: "/api/workspace", body: undefined }]);
  });

  it("sends commands to the server and adopts its response", async () => {
    const server = installFakeServer();
    const { result } = renderHook(() => useWorkspace());
    await waitFor(() => expect(result.current.state.status).toBe("ready"));

    act(() => result.current.addItem("Persisted", "High", "personal"));

    await waitFor(() => expect(ready(result).items[0].title).toBe("Persisted"));
    expect(server.workspace.items[0].title).toBe("Persisted");
    expect(server.workspace.activity[0]).toMatchObject({ action: "task.created", title: "Persisted" });
    expect(server.calls.at(-1)).toMatchObject({ method: "POST", url: "/api/commands", body: { type: "addItem", title: "Persisted" } });
  });

  it("applies rapid commands in order", async () => {
    installFakeServer();
    const { result } = renderHook(() => useWorkspace());
    await waitFor(() => expect(result.current.state.status).toBe("ready"));
    const id = ready(result).items[0].id;

    act(() => {
      result.current.toggleItem(id);
      result.current.toggleItem(id);
    });

    await waitFor(() => expect(ready(result).items[0].status).toBe("todo"));
    const actions = ready(result).activity.slice(0, 3).map((entry) => `${entry.action}:${entry.to ?? ""}`);
    // Completing the (queued) task also drops it from the queue; reopening does not re-queue it.
    expect(actions).toEqual(["task.status_changed:todo", "queue.removed:", "task.status_changed:done"]);
  });

  it("reports an error state when the server is unreachable", async () => {
    const server = installFakeServer();
    server.offline();
    const { result } = renderHook(() => useWorkspace());

    await waitFor(() => expect(result.current.state.status).toBe("error"));
    expect(result.current.state).toMatchObject({ message: "Could not reach the Mango Desk server." });
  });

  it("surfaces a failed command and re-syncs with the server", async () => {
    const server = installFakeServer();
    const { result } = renderHook(() => useWorkspace());
    await waitFor(() => expect(result.current.state.status).toBe("ready"));

    server.failNext(1);
    act(() => result.current.addItem("Lost", "Low", "personal"));

    await waitFor(() => expect(result.current.problem).toBe("Could not reach the Mango Desk server."));
    expect(ready(result).items.map((item) => item.title)).not.toContain("Lost");

    act(() => result.current.addItem("Found", "Low", "personal"));
    await waitFor(() => expect(ready(result).items[0].title).toBe("Found"));
    expect(result.current.problem).toBeNull();
  });

  it("never sends browser-stored data to the server and wipes any stale keys", async () => {
    const stale = { ...initialWorkspace, items: [{ ...initialWorkspace.items[0], title: "From the old days" }] };
    localStorage.setItem(LEGACY_STORAGE_KEYS[0], JSON.stringify(stale));
    localStorage.setItem(LEGACY_STORAGE_KEYS[1], JSON.stringify(stale));
    localStorage.setItem(LEGACY_STORAGE_KEYS[2], JSON.stringify({ profile: "demo" }));
    const server = installFakeServer();
    const { result } = renderHook(() => useWorkspace());

    await waitFor(() => expect(result.current.state.status).toBe("ready"));
    expect(ready(result)).toEqual(initialWorkspace);
    expect(server.workspace).toEqual(initialWorkspace);
    expect(server.calls.map((call) => call.method)).toEqual(["GET"]);
    for (const key of LEGACY_STORAGE_KEYS) expect(localStorage.getItem(key)).toBeNull();
  });
});
