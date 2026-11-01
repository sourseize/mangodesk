import { resolve } from "node:path";
import { createApp } from "./app.ts";
import { DEFAULT_DB_PATH, WorkspaceStore } from "./db.ts";
import { seedStatus } from "./seeding.ts";

const port = Number(process.env.PORT ?? 3001);
const dbPath = process.env.MANGO_DESK_DB ?? DEFAULT_DB_PATH;
const staticDir = resolve(import.meta.dirname, "../dist");

const store = new WorkspaceStore(dbPath);
const app = createApp({ store, staticDir });

const server = app.listen(port, () => {
  const seeded = seedStatus(store);
  console.log(`Mango Desk server listening on http://localhost:${port}`);
  console.log(`  database: ${dbPath}${seeded ? `  (seeded with "${seeded.profile}" at ${seeded.seededAt})` : ""}`);
});

function shutdown() {
  server.close(() => {
    store.close();
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
