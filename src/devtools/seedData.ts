import type {
  ActivityEntry,
  Priority,
  WorkItem,
  WorkStatus,
  Workspace,
  Workstream,
  WorkstreamColor,
} from "../domain/workspace.ts";

/**
 * Deterministic test-data generator.
 *
 * Produces a realistic workspace for manual, smoke and regression testing.
 * The same seed always yields the same data, so assertions in regression
 * tests stay stable. Nothing here touches storage; see seedControl.ts for
 * loading a profile into the running app.
 */

export type SeedProfile = "demo" | "large";

export interface SeedOptions {
  /** PRNG seed; the same seed always produces the same workspace. */
  seed?: number;
  /** Number of work items to generate. */
  items?: number;
  /** Number of workstreams to generate (1–8). */
  workstreams?: number;
  /** How many days back the activity history should stretch. */
  days?: number;
  /** Reference "now" in ms since epoch; defaults to Date.now(). */
  now?: number;
}

export const seedProfiles: Record<SeedProfile, Required<Omit<SeedOptions, "now">>> = {
  demo: { seed: 42, items: 40, workstreams: 6, days: 14 },
  large: { seed: 7, items: 400, workstreams: 8, days: 60 },
};

export function isSeedProfile(value: string | null | undefined): value is SeedProfile {
  return value === "demo" || value === "large";
}

const streamCatalogue: { name: string; color: WorkstreamColor }[] = [
  { name: "Personal", color: "mango" },
  { name: "Studio", color: "tomato" },
  { name: "Home", color: "leaf" },
  { name: "Garden", color: "coral" },
  { name: "Finance", color: "leaf" },
  { name: "Learning", color: "mango" },
  { name: "Side project", color: "tomato" },
  { name: "Family", color: "coral" },
];

const verbs = ["Draft", "Review", "Call", "Plan", "Fix", "Write", "Book", "Clean", "Research", "Send", "Sort", "Prepare"];
const objects = [
  "the quarterly budget", "the kitchen shelves", "the client proposal", "a dentist appointment",
  "next week's meals", "the garden beds", "the portfolio site", "the tax paperwork",
  "the reading list", "the birthday plan", "the bike brakes", "the trip itinerary",
  "the newsletter draft", "the insurance renewal", "the sketchbook pages", "the bookshelf",
];
const suffixes = ["", "", "", " before Friday", " (quick win)", " with notes", " — second pass"];

export function generateSeedWorkspace(profileOrOptions: SeedProfile | SeedOptions = "demo"): Workspace {
  const options: SeedOptions = typeof profileOrOptions === "string"
    ? seedProfiles[profileOrOptions]
    : profileOrOptions;
  const seed = options.seed ?? 1;
  const itemCount = options.items ?? 40;
  const streamCount = Math.min(Math.max(options.workstreams ?? 6, 1), streamCatalogue.length);
  const days = options.days ?? 14;
  const now = options.now ?? Date.now();
  const random = mulberry32(seed);
  const dayMs = 24 * 60 * 60 * 1000;

  const workstreams: Workstream[] = streamCatalogue.slice(0, streamCount).map((entry, index) => ({
    id: `seed-stream-${index + 1}`,
    name: entry.name,
    color: entry.color,
    // Every fourth stream is paused so both states are represented.
    status: index % 4 === 3 ? "paused" : "active",
  }));

  const items: WorkItem[] = [];
  const activity: ActivityEntry[] = [];
  let activityCounter = 0;
  let doneCounter = 0;
  const push = (draft: Omit<ActivityEntry, "id" | "occurredAt">, at: number) => {
    activityCounter += 1;
    activity.push({
      id: `seed-activity-${activityCounter}`,
      occurredAt: new Date(Math.min(at, now)).toISOString(),
      ...draft,
    });
  };

  // Workstreams were created at the start of the window; paused ones were
  // paused somewhere along the way.
  workstreams.forEach((stream, index) => {
    const createdAt = now - days * dayMs + index * 60 * 60 * 1000;
    push({ action: "workstream.created", entityType: "workstream", entityId: stream.id, title: stream.name }, createdAt);
    if (stream.status === "paused") {
      push(
        { action: "workstream.paused", entityType: "workstream", entityId: stream.id, title: stream.name, from: "active", to: "paused" },
        createdAt + random() * (now - createdAt),
      );
    }
  });

  for (let index = 0; index < itemCount; index += 1) {
    const createdAt = now - random() * days * dayMs;
    const status = pickStatus(random());
    const item: WorkItem = {
      id: `seed-item-${index + 1}`,
      title: makeTitle(random, index),
      priority: pickPriority(random()),
      workstreamId: workstreams[Math.floor(random() * workstreams.length)].id,
      status,
      createdAt: new Date(createdAt).toISOString(),
    };
    items.push(item);

    const base = { entityType: "task" as const, entityId: item.id, title: item.title, workstreamId: item.workstreamId, priority: item.priority };
    const move = (from: WorkStatus, to: WorkStatus, at: number) =>
      push({ ...base, action: "task.status_changed", from, to }, at);

    push({ ...base, action: "task.created" }, createdAt);
    const remaining = now - createdAt;
    if (status === "doing") {
      move("todo", "doing", createdAt + random() * remaining);
    } else if (status === "done") {
      const startedAt = createdAt + random() * remaining * 0.5;
      const wentThroughDoing = random() < 0.7;
      if (wentThroughDoing) move("todo", "doing", startedAt);
      const finishedAt = startedAt + random() * (now - startedAt);
      move(wentThroughDoing ? "doing" : "todo", "done", finishedAt);
      // Every fifth finished item was reopened and finished again, so
      // "reopened" transitions are always represented.
      doneCounter += 1;
      if (doneCounter % 5 === 1) {
        const reopenedAt = finishedAt + random() * (now - finishedAt);
        move("done", "todo", reopenedAt);
        move("todo", "done", reopenedAt + random() * (now - reopenedAt));
      }
    }
  }

  // Newest first, matching how the app stores them.
  items.sort((first, second) => second.createdAt.localeCompare(first.createdAt));

  // A focus queue of open tasks, queued recently; one of them was reordered.
  const queueSize = Math.min(Math.max(3, Math.round(itemCount / 7)), 12);
  const focusQueue = items.filter((item) => item.status !== "done").slice(0, queueSize).map((item) => item.id);
  focusQueue.forEach((itemId, index) => {
    const item = items.find((candidate) => candidate.id === itemId)!;
    push(
      { entityType: "task", entityId: item.id, title: item.title, workstreamId: item.workstreamId, priority: item.priority, action: "queue.added", to: String(index + 1) },
      now - (queueSize - index) * 20 * 60 * 1000,
    );
  });
  if (focusQueue.length > 2) {
    const [moved] = focusQueue.splice(focusQueue.length - 1, 1);
    focusQueue.splice(1, 0, moved);
    const item = items.find((candidate) => candidate.id === moved)!;
    push(
      { entityType: "task", entityId: item.id, title: item.title, workstreamId: item.workstreamId, priority: item.priority, action: "queue.moved", from: String(queueSize), to: "2" },
      now - 5 * 60 * 1000,
    );
  }

  activity.sort((first, second) => second.occurredAt.localeCompare(first.occurredAt));

  return { workstreams, items, activity, focusQueue };
}

function makeTitle(random: () => number, index: number): string {
  const verb = verbs[Math.floor(random() * verbs.length)];
  const object = objects[Math.floor(random() * objects.length)];
  const suffix = suffixes[Math.floor(random() * suffixes.length)];
  // Include the ordinal so titles stay unique even in large profiles.
  return `${verb} ${object}${suffix} #${index + 1}`;
}

function pickStatus(roll: number): WorkStatus {
  if (roll < 0.5) return "todo";
  if (roll < 0.7) return "doing";
  return "done";
}

function pickPriority(roll: number): Priority {
  if (roll < 0.25) return "High";
  if (roll < 0.8) return "Normal";
  return "Low";
}

/** Small, fast seeded PRNG (32-bit); good enough for fixtures. */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
