import { DEFAULT_DB_PATH, WorkspaceStore } from "./db.ts";
import { clearSeed, isSeedProfile, seed, seedStatus } from "./seeding.ts";

/**
 * Seed CLI — the only way test data gets into or out of the database.
 *
 *   npm run seed -- demo     load the demo profile (backs up the current workspace)
 *   npm run seed -- large    load the large profile
 *   npm run seed -- clear    remove seed data and restore the backup
 *   npm run seed -- status   show whether seed data is active
 *
 * Set MANGO_DESK_DB to target a different database file.
 */

const command = process.argv[2];
const dbPath = process.env.MANGO_DESK_DB ?? DEFAULT_DB_PATH;

if (command !== "clear" && command !== "status" && !isSeedProfile(command)) {
  console.error("Usage: npm run seed -- <demo|large|clear|status>");
  process.exit(1);
}

const store = new WorkspaceStore(dbPath);
try {
  if (command === "status") {
    const state = seedStatus(store);
    console.log(state ? `Seed data active: "${state.profile}" (since ${state.seededAt})` : "No seed data active.");
  } else if (command === "clear") {
    const { restored } = clearSeed(store);
    console.log(restored ? "Seed data removed; previous workspace restored." : "Seed data removed; workspace reset.");
  } else {
    const state = seed(store, command);
    const workspace = store.load();
    console.log(`Seeded "${state.profile}": ${workspace.items.length} tasks, ${workspace.workstreams.length} workstreams, ${workspace.activity.length} history entries.`);
  }
  console.log(`  database: ${dbPath}`);
} finally {
  store.close();
}
