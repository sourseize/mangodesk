import type { Command } from "../domain/commands";
import type { Workspace } from "../domain/workspace";
import { parseWorkspace } from "../domain/workspaceSchema";

/** Thin HTTP client. The browser only ever sees what the server returns. */

export class ApiError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export async function fetchWorkspace(): Promise<Workspace> {
  return workspaceFrom(await request("/api/workspace"));
}

export async function sendCommand(command: Command): Promise<Workspace> {
  return workspaceFrom(await request("/api/commands", { method: "POST", body: JSON.stringify(command) }));
}

async function request(url: string, init: RequestInit = {}): Promise<Record<string, unknown>> {
  let response: Response;
  try {
    response = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...init.headers } });
  } catch {
    throw new ApiError("Could not reach the Mango Desk server.");
  }
  const body: unknown = await response.json().catch(() => null);
  const record = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
  if (!response.ok) {
    const message = typeof record.error === "string" ? record.error : `Server responded with ${response.status}.`;
    throw new ApiError(message, response.status);
  }
  return record;
}

function workspaceFrom(body: Record<string, unknown>): Workspace {
  const workspace = parseWorkspace(body.workspace);
  if (!workspace) throw new ApiError("The server returned an unexpected workspace.");
  return workspace;
}
