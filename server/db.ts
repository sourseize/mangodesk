import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { initialWorkspace, type ActivityEntry, type WorkItem, type Workspace, type Workstream } from "../src/domain/workspace.ts";

/**
 * SQLite-backed workspace store. The workspace is normalised into three
 * tables; ordering (newest first) is preserved through a position column.
 */

export const DEFAULT_DB_PATH = "data/mango-desk.sqlite";

const schema = `
  CREATE TABLE IF NOT EXISTS workstreams (
    id TEXT PRIMARY KEY,
    position INTEGER NOT NULL,
    name TEXT NOT NULL,
    color TEXT NOT NULL,
    status TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS items (
    id TEXT PRIMARY KEY,
    position INTEGER NOT NULL,
    title TEXT NOT NULL,
    priority TEXT NOT NULL,
    workstream_id TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS activity (
    id TEXT PRIMARY KEY,
    position INTEGER NOT NULL,
    occurred_at TEXT NOT NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    title TEXT NOT NULL,
    workstream_id TEXT,
    priority TEXT,
    from_value TEXT,
    to_value TEXT
  );
  CREATE TABLE IF NOT EXISTS focus_queue (
    item_id TEXT PRIMARY KEY,
    position INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`;

const META_TOUCHED = "touched";

export class WorkspaceStore {
  private readonly db: DatabaseSync;
  private depth = 0;
  readonly path: string;

  constructor(path: string = DEFAULT_DB_PATH) {
    this.path = path;
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec("PRAGMA journal_mode = WAL;");
    this.db.exec(schema);
    this.migrate();
    if (this.getMeta("initialized") === null) {
      this.save(initialWorkspace, { touch: false });
      this.setMeta("initialized", new Date().toISOString());
    }
  }

  load(): Workspace {
    const workstreams = this.rows<WorkstreamRow>("SELECT * FROM workstreams ORDER BY position");
    const items = this.rows<ItemRow>("SELECT * FROM items ORDER BY position");
    const activity = this.rows<ActivityRow>("SELECT * FROM activity ORDER BY position");
    const queue = this.rows<{ item_id: string }>("SELECT item_id FROM focus_queue ORDER BY position");
    return {
      focusQueue: queue.map((row) => row.item_id),
      workstreams: workstreams.map((row) => ({ id: row.id, name: row.name, color: row.color, status: row.status })),
      items: items.map((row) => ({
        id: row.id,
        title: row.title,
        priority: row.priority,
        workstreamId: row.workstream_id,
        status: row.status,
        createdAt: row.created_at,
      })),
      activity: activity.map((row) => ({
        id: row.id,
        occurredAt: row.occurred_at,
        action: row.action,
        entityType: row.entity_type,
        entityId: row.entity_id,
        title: row.title,
        ...(row.workstream_id === null ? {} : { workstreamId: row.workstream_id }),
        ...(row.priority === null ? {} : { priority: row.priority }),
        ...(row.from_value === null ? {} : { from: row.from_value }),
        ...(row.to_value === null ? {} : { to: row.to_value }),
      })),
    };
  }

  /** Replaces the stored workspace atomically. */
  save(workspace: Workspace, { touch = true }: { touch?: boolean } = {}): void {
    // Columns are named explicitly: ALTER TABLE migrations append columns, so
    // the physical order differs between fresh and upgraded databases.
    const insertStream = this.db.prepare(
      "INSERT INTO workstreams (id, position, name, color, status) VALUES (?, ?, ?, ?, ?)",
    );
    const insertItem = this.db.prepare(
      "INSERT INTO items (id, position, title, priority, workstream_id, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    );
    const insertActivity = this.db.prepare(
      `INSERT INTO activity (id, position, occurred_at, action, entity_type, entity_id, title, workstream_id, priority, from_value, to_value)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const insertQueue = this.db.prepare("INSERT INTO focus_queue (item_id, position) VALUES (?, ?)");
    this.transaction(() => {
      this.db.exec("DELETE FROM workstreams; DELETE FROM items; DELETE FROM activity; DELETE FROM focus_queue;");
      workspace.focusQueue.forEach((itemId, position) => insertQueue.run(itemId, position));
      workspace.workstreams.forEach((stream, position) =>
        insertStream.run(stream.id, position, stream.name, stream.color, stream.status));
      workspace.items.forEach((item, position) =>
        insertItem.run(item.id, position, item.title, item.priority, item.workstreamId, item.status, item.createdAt));
      workspace.activity.forEach((entry, position) =>
        insertActivity.run(
          entry.id, position, entry.occurredAt, entry.action, entry.entityType, entry.entityId, entry.title,
          entry.workstreamId ?? null, entry.priority ?? null, entry.from ?? null, entry.to ?? null,
        ));
      if (touch) this.setMeta(META_TOUCHED, "1");
    });
  }

  /** True until the first change lands; seeding uses it to restore a pristine database faithfully. */
  isFresh(): boolean {
    return this.getMeta(META_TOUCHED) === null;
  }

  markFresh(): void {
    this.setMeta(META_TOUCHED, null);
  }

  getMeta(key: string): string | null {
    const row = this.db.prepare("SELECT value FROM meta WHERE key = ?").get(key) as { value: string } | undefined;
    return row?.value ?? null;
  }

  setMeta(key: string, value: string | null): void {
    if (value === null) {
      this.db.prepare("DELETE FROM meta WHERE key = ?").run(key);
    } else {
      this.db.prepare("INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(key, value);
    }
  }

  /** Brings databases created by earlier versions up to the current schema. */
  private migrate(): void {
    const columns = this.rows<{ name: string }>("PRAGMA table_info(activity)").map((column) => column.name);
    if (!columns.includes("priority")) this.db.exec("ALTER TABLE activity ADD COLUMN priority TEXT");
  }

  private rows<Row>(sql: string): Row[] {
    return this.db.prepare(sql).all() as unknown as Row[];
  }

  /** Runs work atomically; nested calls join the outer transaction via savepoints. */
  transaction<T>(work: () => T): T {
    const savepoint = `sp${this.depth}`;
    this.db.exec(this.depth === 0 ? "BEGIN" : `SAVEPOINT ${savepoint}`);
    this.depth += 1;
    try {
      const result = work();
      this.depth -= 1;
      this.db.exec(this.depth === 0 ? "COMMIT" : `RELEASE ${savepoint}`);
      return result;
    } catch (error) {
      this.depth -= 1;
      this.db.exec(this.depth === 0 ? "ROLLBACK" : `ROLLBACK TO ${savepoint}; RELEASE ${savepoint}`);
      throw error;
    }
  }

  close(): void {
    this.db.close();
  }
}

interface WorkstreamRow { id: string; position: number; name: string; color: Workstream["color"]; status: Workstream["status"] }
interface ItemRow {
  id: string; position: number; title: string; priority: WorkItem["priority"]; workstream_id: string;
  status: WorkItem["status"]; created_at: string;
}
interface ActivityRow {
  id: string; position: number; occurred_at: string; action: ActivityEntry["action"]; entity_type: ActivityEntry["entityType"];
  entity_id: string; title: string; workstream_id: string | null; priority: WorkItem["priority"] | null;
  from_value: string | null; to_value: string | null;
}
