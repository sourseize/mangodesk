import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { initialWorkspace } from "../src/domain/workspace.ts";
import { createApp } from "./app.ts";
import { WorkspaceStore } from "./db.ts";
import { seed } from "./seeding.ts";

const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
});

async function startServer(options: { staticDir?: string; seeded?: boolean } = {}) {
  const store = new WorkspaceStore(":memory:");
  if (options.seeded) seed(store, "demo");
  const server: Server = await new Promise((resolve) => {
    const listening = createApp({ store, staticDir: options.staticDir }).listen(0, () => resolve(listening));
  });
  cleanups.push(() => { server.close(); store.close(); });
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const api = async (path: string, init?: RequestInit) => {
    const response = await fetch(base + path, { ...init, headers: { "Content-Type": "application/json" } });
    // Responses are inspected loosely on purpose: these tests pin the wire shape.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body: any = await response.json().catch(() => null);
    return { status: response.status, body, response };
  };
  return { store, base, api };
}

describe("API", () => {
  it("reports health", async () => {
    const { api } = await startServer();
    expect(await api("/api/health")).toMatchObject({ status: 200, body: { ok: true } });
  });

  it("returns exactly the stored workspace for a fresh database", async () => {
    const { api } = await startServer();
    const { status, body } = await api("/api/workspace");
    expect(status).toBe(200);
    expect(body).toEqual({ workspace: initialWorkspace });
  });

  it("serves seeded data without the client being able to tell", async () => {
    const { api } = await startServer({ seeded: true });
    const { body } = await api("/api/workspace");
    expect(body.workspace.items).toHaveLength(40);
    expect(Object.keys(body)).toEqual(["workspace"]);
  });

  it("applies commands, persists them and records history", async () => {
    const { api, store } = await startServer();
    const added = await api("/api/commands", {
      method: "POST",
      body: JSON.stringify({ type: "addItem", title: "Via API", priority: "High", workstreamId: "studio" }),
    });
    expect(added.status).toBe(200);
    expect(added.body.workspace.items[0]).toMatchObject({ title: "Via API", status: "todo" });
    expect(added.body.workspace.activity[0]).toMatchObject({ action: "task.created", title: "Via API" });

    const id = added.body.workspace.items[0].id;
    const moved = await api("/api/commands", { method: "POST", body: JSON.stringify({ type: "setItemStatus", itemId: id, status: "done" }) });
    expect(moved.body.workspace.items[0].status).toBe("done");
    expect(store.load().items[0]).toMatchObject({ title: "Via API", status: "done" });
    expect(store.isFresh()).toBe(false);
  });

  it("rejects malformed commands with 400", async () => {
    const { api } = await startServer();
    expect(await api("/api/commands", { method: "POST", body: JSON.stringify({ type: "addItem", title: "" }) }))
      .toMatchObject({ status: 400, body: { error: "title must be 1–120 characters." } });
    expect(await api("/api/commands", { method: "POST", body: "{not json" })).toMatchObject({ status: 400 });
  });

  it("answers 404 for unknown targets and unknown routes", async () => {
    const { api } = await startServer();
    expect(await api("/api/commands", { method: "POST", body: JSON.stringify({ type: "toggleItem", itemId: "nope" }) }))
      .toMatchObject({ status: 404, body: { error: "Task not found." } });
    expect(await api("/api/nothing")).toMatchObject({ status: 404, body: { error: "Not found." } });
  });

  it("offers no way to replace the workspace wholesale", async () => {
    const { api, store } = await startServer();
    const attempt = await api("/api/workspace", { method: "PUT", body: JSON.stringify({ items: [], activity: [] }) });
    expect(attempt.status).toBe(404);
    expect(store.load()).toEqual(initialWorkspace);
  });

  it("serves the built client with an SPA fallback when a static directory exists", async () => {
    const dir = mkdtempSync(join(tmpdir(), "mango-desk-static-"));
    cleanups.push(() => rmSync(dir, { recursive: true, force: true }));
    writeFileSync(join(dir, "index.html"), "<html><body>desk</body></html>");

    const { base } = await startServer({ staticDir: dir });
    expect(await (await fetch(base + "/")).text()).toContain("desk");
    expect(await (await fetch(base + "/some/client/route")).text()).toContain("desk");
    expect((await fetch(base + "/api/nothing")).status).toBe(404);
  });
});
