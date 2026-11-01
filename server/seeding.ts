import { generateSeedWorkspace, isSeedProfile, seedProfiles, type SeedProfile } from "../src/devtools/seedData.ts";
import { initialWorkspace } from "../src/domain/workspace.ts";
import { parseWorkspace } from "../src/domain/workspaceSchema.ts";
import type { WorkspaceStore } from "./db.ts";

/**
 * Server-side test-data seeding. The client has no way to trigger any of
 * this; it only ever reads whatever the store contains.
 *
 * Seeding backs up the current workspace; clearing restores it.
 */

export { isSeedProfile, type SeedProfile };

const META_SEED = "seed";
const META_BACKUP = "seed.backup";
const META_BACKUP_FRESH = "seed.backup.fresh";

export interface SeedState {
  profile: SeedProfile;
  seededAt: string;
}

export function seedStatus(store: WorkspaceStore): SeedState | null {
  const raw = store.getMeta(META_SEED);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<SeedState>;
    if (isSeedProfile(parsed.profile) && typeof parsed.seededAt === "string") {
      return { profile: parsed.profile, seededAt: parsed.seededAt };
    }
  } catch {
    // fall through
  }
  return null;
}

export function seed(store: WorkspaceStore, profile: SeedProfile, now: Date = new Date()): SeedState {
  return store.transaction(() => {
    if (!seedStatus(store)) {
      store.setMeta(META_BACKUP, JSON.stringify(store.load()));
      store.setMeta(META_BACKUP_FRESH, store.isFresh() ? "1" : "0");
    }
    store.save(generateSeedWorkspace({ ...seedProfiles[profile], now: now.getTime() }));
    const state: SeedState = { profile, seededAt: now.toISOString() };
    store.setMeta(META_SEED, JSON.stringify(state));
    return state;
  });
}

/** Removes seed data and restores the backed-up workspace (or the starter one). */
export function clearSeed(store: WorkspaceStore): { restored: boolean } {
  return store.transaction(() => {
    const backup = parseWorkspace(safeJson(store.getMeta(META_BACKUP)));
    const wasFresh = store.getMeta(META_BACKUP_FRESH) === "1";
    const hadSeed = seedStatus(store) !== null;
    store.save(backup ?? initialWorkspace);
    if (!backup || wasFresh) store.markFresh();
    store.setMeta(META_SEED, null);
    store.setMeta(META_BACKUP, null);
    store.setMeta(META_BACKUP_FRESH, null);
    return { restored: hadSeed && backup !== null };
  });
}

function safeJson(raw: string | null): unknown {
  if (raw === null) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
