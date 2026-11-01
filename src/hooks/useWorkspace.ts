import { useCallback, useEffect, useRef, useState } from "react";
import { fetchWorkspace, sendCommand } from "../api/client";
import { applyCommand, type Command } from "../domain/commands";
import type { Priority, WorkStatus, Workspace, WorkstreamColor } from "../domain/workspace";

/**
 * Keys used by the browser-only version of the app. They are removed on
 * startup so stale data can never find its way back in; the server is the
 * only source of truth.
 */
export const LEGACY_STORAGE_KEYS = ["mango-desk.workspace.v1", "mango-desk.workspace.backup.v1", "mango-desk.seed.v1"];

export type WorkspaceState =
  | { status: "loading" }
  | { status: "ready"; workspace: Workspace }
  | { status: "error"; message: string };

export function useWorkspace() {
  const [state, setState] = useState<WorkspaceState>({ status: "loading" });
  const [problem, setProblem] = useState<string | null>(null);
  const queue = useRef(Promise.resolve());

  const load = useCallback(async () => {
    setState({ status: "loading" });
    try {
      const workspace = await fetchWorkspace();
      setState({ status: "ready", workspace });
    } catch (error) {
      setState({ status: "error", message: messageOf(error) });
    }
  }, []);

  useEffect(() => {
    clearLegacyStorage();
    void load();
  }, [load]);

  const dispatch = useCallback((command: Command) => {
    // Queue changes are applied locally first so drag-and-drop and keyboard
    // reordering feel instant; the server's answer replaces the guess.
    if (optimisticCommands.has(command.type)) {
      setState((current) =>
        current.status === "ready" ? { status: "ready", workspace: applyCommand(current.workspace, command) } : current);
    }
    // Commands are sent one at a time so the server applies them in order.
    queue.current = queue.current
      .then(() => sendCommand(command))
      .then((workspace) => {
        setProblem(null);
        setState({ status: "ready", workspace });
      })
      .catch(async (error: unknown) => {
        setProblem(messageOf(error));
        // Re-sync with whatever the server actually has.
        try {
          const workspace = await fetchWorkspace();
          setState({ status: "ready", workspace });
        } catch {
          // keep showing the last known workspace
        }
      });
  }, []);

  const addItem = useCallback((title: string, priority: Priority, workstreamId: string) =>
    dispatch({ type: "addItem", title, priority, workstreamId }), [dispatch]);
  const toggleItem = useCallback((itemId: string) => dispatch({ type: "toggleItem", itemId }), [dispatch]);
  const setItemStatus = useCallback((itemId: string, status: WorkStatus) =>
    dispatch({ type: "setItemStatus", itemId, status }), [dispatch]);
  const addWorkstream = useCallback((name: string, color: WorkstreamColor) =>
    dispatch({ type: "addWorkstream", name, color }), [dispatch]);
  const toggleWorkstreamStatus = useCallback((workstreamId: string) =>
    dispatch({ type: "toggleWorkstreamStatus", workstreamId }), [dispatch]);
  const enqueueItem = useCallback((itemId: string) => dispatch({ type: "enqueueItem", itemId }), [dispatch]);
  const dequeueItem = useCallback((itemId: string) => dispatch({ type: "dequeueItem", itemId }), [dispatch]);
  const moveInQueue = useCallback((itemId: string, toIndex: number) =>
    dispatch({ type: "moveInQueue", itemId, toIndex }), [dispatch]);

  return {
    state,
    problem,
    reload: load,
    addItem,
    toggleItem,
    setItemStatus,
    addWorkstream,
    toggleWorkstreamStatus,
    enqueueItem,
    dequeueItem,
    moveInQueue,
  };
}

const optimisticCommands = new Set<Command["type"]>(["enqueueItem", "dequeueItem", "moveInQueue"]);

function clearLegacyStorage(): void {
  try {
    for (const key of LEGACY_STORAGE_KEYS) localStorage.removeItem(key);
  } catch {
    // storage unavailable; nothing to clean
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}
