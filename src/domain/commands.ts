import type { Priority, WorkStatus, Workspace, WorkstreamColor } from "./workspace.ts";
import { workstreamColors } from "./workspace.ts";
import * as operations from "./workspaceOperations.ts";
import type { OperationContext } from "./workspaceOperations.ts";

/**
 * Commands are the only way the client changes the workspace. The server
 * applies them with the pure operations and records the audit trail.
 */
export type Command =
  | { type: "addItem"; title: string; priority: Priority; workstreamId: string }
  | { type: "toggleItem"; itemId: string }
  | { type: "setItemStatus"; itemId: string; status: WorkStatus }
  | { type: "addWorkstream"; name: string; color: WorkstreamColor }
  | { type: "toggleWorkstreamStatus"; workstreamId: string }
  | { type: "enqueueItem"; itemId: string }
  | { type: "dequeueItem"; itemId: string }
  | { type: "moveInQueue"; itemId: string; toIndex: number };

export type CommandType = Command["type"];

export const TITLE_MAX_LENGTH = 120;
export const WORKSTREAM_NAME_MAX_LENGTH = 32;

export function applyCommand(
  workspace: Workspace,
  command: Command,
  context: OperationContext = operations.liveContext,
): Workspace {
  switch (command.type) {
    case "addItem":
      return operations.addItem(workspace, command, context);
    case "toggleItem":
      return operations.toggleItem(workspace, command.itemId, context);
    case "setItemStatus":
      return operations.setItemStatus(workspace, command.itemId, command.status, context);
    case "addWorkstream":
      return operations.addWorkstream(workspace, command.name, command.color, context);
    case "toggleWorkstreamStatus":
      return operations.toggleWorkstreamStatus(workspace, command.workstreamId, context);
    case "enqueueItem":
      return operations.enqueueItem(workspace, command.itemId, context);
    case "dequeueItem":
      return operations.dequeueItem(workspace, command.itemId, context);
    case "moveInQueue":
      return operations.moveInQueue(workspace, command.itemId, command.toIndex, context);
  }
}

export type CommandParseResult = { ok: true; command: Command } | { ok: false; error: string };

/** Validates an untrusted payload (e.g. a request body) into a Command. */
export function parseCommand(value: unknown): CommandParseResult {
  if (typeof value !== "object" || value === null) return fail("Command must be an object.");
  const body = value as Record<string, unknown>;
  switch (body.type) {
    case "addItem": {
      const title = trimmedString(body.title, TITLE_MAX_LENGTH);
      if (!title) return fail(`title must be 1–${TITLE_MAX_LENGTH} characters.`);
      if (!isPriority(body.priority)) return fail("priority must be Low, Normal or High.");
      if (!nonEmptyString(body.workstreamId)) return fail("workstreamId is required.");
      return ok({ type: "addItem", title, priority: body.priority, workstreamId: body.workstreamId });
    }
    case "toggleItem":
      if (!nonEmptyString(body.itemId)) return fail("itemId is required.");
      return ok({ type: "toggleItem", itemId: body.itemId });
    case "setItemStatus":
      if (!nonEmptyString(body.itemId)) return fail("itemId is required.");
      if (!isWorkStatus(body.status)) return fail("status must be todo, doing or done.");
      return ok({ type: "setItemStatus", itemId: body.itemId, status: body.status });
    case "addWorkstream": {
      const name = trimmedString(body.name, WORKSTREAM_NAME_MAX_LENGTH);
      if (!name) return fail(`name must be 1–${WORKSTREAM_NAME_MAX_LENGTH} characters.`);
      if (!isWorkstreamColor(body.color)) return fail(`color must be one of ${workstreamColors.join(", ")}.`);
      return ok({ type: "addWorkstream", name, color: body.color });
    }
    case "toggleWorkstreamStatus":
      if (!nonEmptyString(body.workstreamId)) return fail("workstreamId is required.");
      return ok({ type: "toggleWorkstreamStatus", workstreamId: body.workstreamId });
    case "enqueueItem":
    case "dequeueItem":
      if (!nonEmptyString(body.itemId)) return fail("itemId is required.");
      return ok({ type: body.type, itemId: body.itemId });
    case "moveInQueue":
      if (!nonEmptyString(body.itemId)) return fail("itemId is required.");
      if (typeof body.toIndex !== "number" || !Number.isInteger(body.toIndex) || body.toIndex < 0) {
        return fail("toIndex must be a non-negative integer.");
      }
      return ok({ type: "moveInQueue", itemId: body.itemId, toIndex: body.toIndex });
    default:
      return fail("Unknown command type.");
  }
}

/** Returns a problem description when the command points at something that does not exist. */
export function findCommandTarget(workspace: Workspace, command: Command): string | null {
  switch (command.type) {
    case "addItem":
      return workspace.workstreams.some((stream) => stream.id === command.workstreamId) ? null : "Workstream not found.";
    case "toggleItem":
    case "setItemStatus":
    case "enqueueItem":
    case "dequeueItem":
    case "moveInQueue":
      return workspace.items.some((item) => item.id === command.itemId) ? null : "Task not found.";
    case "toggleWorkstreamStatus":
      return workspace.workstreams.some((stream) => stream.id === command.workstreamId) ? null : "Workstream not found.";
    case "addWorkstream":
      return null;
  }
}

function ok(command: Command): CommandParseResult {
  return { ok: true, command };
}

function fail(error: string): CommandParseResult {
  return { ok: false, error };
}

function trimmedString(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= max ? trimmed : null;
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isPriority(value: unknown): value is Priority {
  return value === "Low" || value === "Normal" || value === "High";
}

function isWorkStatus(value: unknown): value is WorkStatus {
  return value === "todo" || value === "doing" || value === "done";
}

function isWorkstreamColor(value: unknown): value is WorkstreamColor {
  return (workstreamColors as unknown[]).includes(value);
}
