import { describe, expect, it } from "vitest";
import { initialWorkspace } from "../src/domain/workspace.ts";
import { WorkspaceStore } from "./db.ts";
import { clearSeed, seed, seedStatus } from "./seeding.ts";

const NOW = new Date("2026-01-01T00:00:00.000Z");

describe("seeding", () => {
  it("backs up the current workspace, seeds, and restores on clear", () => {
    const store = new WorkspaceStore(":memory:");
    store.save({ ...initialWorkspace, items: [{ ...initialWorkspace.items[0], title: "My real task" }] });

    const state = seed(store, "demo", NOW);
    expect(state).toEqual({ profile: "demo", seededAt: NOW.toISOString() });
    expect(seedStatus(store)).toEqual(state);
    expect(store.load().items).toHaveLength(40);
    expect(store.isFresh()).toBe(false);

    expect(clearSeed(store)).toEqual({ restored: true });
    expect(seedStatus(store)).toBeNull();
    expect(store.load().items.map((item) => item.title)).toEqual(["My real task"]);
    expect(store.isFresh()).toBe(false);
    store.close();
  });

  it("keeps the original backup when switching profiles", () => {
    const store = new WorkspaceStore(":memory:");
    store.save({ ...initialWorkspace, items: [] });
    seed(store, "demo");
    seed(store, "large");
    expect(seedStatus(store)?.profile).toBe("large");
    expect(store.load().items).toHaveLength(400);

    clearSeed(store);
    expect(store.load().items).toEqual([]);
    store.close();
  });

  it("leaves a fresh database fresh after clearing", () => {
    const store = new WorkspaceStore(":memory:");
    seed(store, "demo");
    expect(store.isFresh()).toBe(false);
    clearSeed(store);
    expect(store.load()).toEqual(initialWorkspace);
    expect(store.isFresh()).toBe(true);
    store.close();
  });

  it("clearing without seed data resets to the starter workspace", () => {
    const store = new WorkspaceStore(":memory:");
    store.save({ ...initialWorkspace, items: [] });
    expect(clearSeed(store)).toEqual({ restored: false });
    expect(store.load()).toEqual(initialWorkspace);
    store.close();
  });

  it("ignores a corrupt seed marker", () => {
    const store = new WorkspaceStore(":memory:");
    store.setMeta("seed", "{oops");
    expect(seedStatus(store)).toBeNull();
    store.close();
  });
});
