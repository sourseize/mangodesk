import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { afterEach, describe, expect, it } from "vitest";
import { generateSeedWorkspace } from "../src/devtools/seedData.ts";
import { initialWorkspace } from "../src/domain/workspace.ts";
import { WorkspaceStore } from "./db.ts";

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function tempPath(): string {
  const dir = mkdtempSync(join(tmpdir(), "mango-desk-"));
  dirs.push(dir);
  return join(dir, "nested", "desk.sqlite");
}

describe("WorkspaceStore", () => {
  it("starts a new database with the starter workspace, marked fresh", () => {
    const store = new WorkspaceStore(":memory:");
    expect(store.load()).toEqual(initialWorkspace);
    expect(store.isFresh()).toBe(true);
    store.close();
  });

  it("round-trips a full workspace including optional activity fields", () => {
    const store = new WorkspaceStore(":memory:");
    const workspace = generateSeedWorkspace({ seed: 3, items: 30, workstreams: 4, days: 5, now: Date.UTC(2026, 0, 1) });
    store.save(workspace);
    expect(store.load()).toEqual(workspace);
    expect(store.isFresh()).toBe(false);
    store.close();
  });

  it("persists to disk, creating parent directories", () => {
    const path = tempPath();
    const first = new WorkspaceStore(path);
    first.save({ ...initialWorkspace, items: [{ ...initialWorkspace.items[0], title: "On disk" }] });
    first.close();

    const second = new WorkspaceStore(path);
    expect(second.load().items[0].title).toBe("On disk");
    expect(second.isFresh()).toBe(false);
    second.close();
  });

  it("does not overwrite existing data when reopened", () => {
    const path = tempPath();
    const first = new WorkspaceStore(path);
    first.save({ ...initialWorkspace, items: [] });
    first.close();
    const second = new WorkspaceStore(path);
    expect(second.load().items).toEqual([]);
    second.close();
  });

  it("upgrades a database created before the activity priority column existed", () => {
    const path = tempPath();
    const legacy = new WorkspaceStore(path);
    legacy.close();
    // Simulate the old schema by rebuilding the table without the column.
    const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as typeof import("node:sqlite");
    const raw = new DatabaseSync(path);
    raw.exec(`
      DROP TABLE activity;
      CREATE TABLE activity (
        id TEXT PRIMARY KEY, position INTEGER NOT NULL, occurred_at TEXT NOT NULL, action TEXT NOT NULL,
        entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, title TEXT NOT NULL, workstream_id TEXT,
        from_value TEXT, to_value TEXT
      );
      INSERT INTO activity VALUES ('old', 0, '2025-01-01T00:00:00.000Z', 'task.created', 'task', 'x', 'Old', 'personal', NULL, NULL);
    `);
    raw.close();

    const upgraded = new WorkspaceStore(path);
    expect(upgraded.load().activity).toEqual([
      { id: "old", occurredAt: "2025-01-01T00:00:00.000Z", action: "task.created", entityType: "task", entityId: "x", title: "Old", workstreamId: "personal" },
    ]);
    upgraded.save({ ...initialWorkspace, activity: [{ ...initialWorkspace.activity[0], priority: "Low" }] });
    expect(upgraded.load().activity[0].priority).toBe("Low");
    upgraded.close();
  });

  it("stores and clears meta values", () => {
    const store = new WorkspaceStore(":memory:");
    store.setMeta("k", "v");
    expect(store.getMeta("k")).toBe("v");
    store.setMeta("k", "w");
    expect(store.getMeta("k")).toBe("w");
    store.setMeta("k", null);
    expect(store.getMeta("k")).toBeNull();
    store.close();
  });

  it("rolls back a failed transaction, including nested ones", () => {
    const store = new WorkspaceStore(":memory:");
    expect(() =>
      store.transaction(() => {
        store.setMeta("outer", "1");
        store.transaction(() => {
          store.setMeta("inner", "1");
        });
        throw new Error("boom");
      }),
    ).toThrow("boom");
    expect(store.getMeta("outer")).toBeNull();
    expect(store.getMeta("inner")).toBeNull();

    store.transaction(() => {
      store.setMeta("outer", "2");
      expect(() => store.transaction(() => { store.setMeta("inner", "2"); throw new Error("inner"); })).toThrow("inner");
    });
    expect(store.getMeta("outer")).toBe("2");
    expect(store.getMeta("inner")).toBeNull();
    store.close();
  });
});
