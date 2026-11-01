import { vi } from "vitest";
import { applyCommand, findCommandTarget, parseCommand } from "../domain/commands";
import { initialWorkspace, type Workspace } from "../domain/workspace";

/**
 * In-process stand-in for the HTTP API, backed by the same shared command
 * logic the real server uses. Installed as a `fetch` stub for component and
 * hook tests; the workspace lives in memory only.
 */

export interface FakeServer {
  readonly workspace: Workspace;
  readonly calls: { method: string; url: string; body?: unknown }[];
  /** Make the next `count` requests fail with a network error. */
  failNext(count?: number): void;
  /** Cut the connection entirely. */
  offline(): void;
}

export function installFakeServer(initial: Workspace = initialWorkspace): FakeServer {
  let workspace = structuredClone(initial);
  let failures = 0;
  let isOffline = false;
  const calls: FakeServer["calls"] = [];

  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const method = init.method ?? "GET";
    const body = typeof init.body === "string" ? JSON.parse(init.body) : undefined;
    calls.push({ method, url, body });

    if (isOffline || failures > 0) {
      failures = Math.max(0, failures - 1);
      throw new TypeError("Failed to fetch");
    }

    if (url === "/api/workspace" && method === "GET") {
      return json({ workspace });
    }
    if (url === "/api/commands" && method === "POST") {
      const parsed = parseCommand(body);
      if (!parsed.ok) return json({ error: parsed.error }, 400);
      const problem = findCommandTarget(workspace, parsed.command);
      if (problem) return json({ error: problem }, 404);
      workspace = applyCommand(workspace, parsed.command);
      return json({ workspace });
    }
    return json({ error: "Not found." }, 404);
  });

  return {
    get workspace() {
      return workspace;
    },
    calls,
    failNext(count = 1) {
      failures = count;
    },
    offline() {
      isOffline = true;
    },
  };
}

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), { status, headers: { "Content-Type": "application/json" } });
}
