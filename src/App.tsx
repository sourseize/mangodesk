import { useState } from "react";
import { ActivityFeed } from "./components/ActivityFeed";
import { BoardView } from "./components/BoardView";
import { HistoryView } from "./components/HistoryView";
import { QueueView } from "./components/QueueView";
import { TaskComposer } from "./components/TaskComposer";
import { TaskList } from "./components/TaskList";
import { TaskToolbar } from "./components/TaskToolbar";
import { WorkstreamBar } from "./components/WorkstreamBar";
import { countTasks, filterByPriority, sortTasks, type PriorityFilter, type TaskSort } from "./domain/taskFilters";
import { priorities, type Workspace } from "./domain/workspace";
import { useWorkspace } from "./hooks/useWorkspace";

export default function App() {
  const { state, problem, reload, ...actions } = useWorkspace();

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#" aria-label="Mango Desk home">
          <span className="brand-fruit" aria-hidden="true">✳</span>
          <span>MANGO<span className="brand-light">DESK</span></span>
        </a>
        <div className="topbar-right">
          <span className="offline-indicator"><i /> {state.status === "error" ? "OFFLINE" : "LOCAL SERVER"}</span>
          <span className="avatar" aria-label="Your workspace">M</span>
        </div>
      </header>

      <main>
        {problem && (
          <div className="notice notice-problem" role="alert">
            <span aria-hidden="true">!</span>
            <p>That change didn’t go through: {problem}</p>
          </div>
        )}
        {state.status === "loading" && (
          <div className="empty-state app-status" role="status">
            <span aria-hidden="true">✳</span>
            <strong>Setting the desk…</strong>
          </div>
        )}
        {state.status === "error" && (
          <div className="empty-state app-status" role="alert">
            <span aria-hidden="true">✳</span>
            <strong>Can’t reach your desk.</strong>
            <p>{state.message} Start the server with <code>npm start</code> and try again.</p>
            <button type="button" className="retry-button" onClick={() => void reload()}>Try again</button>
          </div>
        )}
        {state.status === "ready" && <Desk workspace={state.workspace} {...actions} />}
      </main>
      <footer className="page-footer"><span>MADE FOR YOUR ACTUAL LIFE</span><span>NO CLOUD. NO NOISE. JUST YOU.</span></footer>
    </div>
  );
}

interface DeskProps {
  workspace: Workspace;
  addItem: (title: string, priority: Workspace["items"][number]["priority"], workstreamId: string) => void;
  toggleItem: (itemId: string) => void;
  setItemStatus: (itemId: string, status: Workspace["items"][number]["status"]) => void;
  addWorkstream: (name: string, color: Workspace["workstreams"][number]["color"]) => void;
  toggleWorkstreamStatus: (workstreamId: string) => void;
  enqueueItem: (itemId: string) => void;
  dequeueItem: (itemId: string) => void;
  moveInQueue: (itemId: string, toIndex: number) => void;
}

function Desk({
  workspace,
  addItem,
  toggleItem,
  setItemStatus,
  addWorkstream,
  toggleWorkstreamStatus,
  enqueueItem,
  dequeueItem,
  moveInQueue,
}: DeskProps) {
  const [selectedWorkstreamId, setSelectedWorkstreamId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "board" | "queue" | "history">("list");
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("all");
  const [taskSort, setTaskSort] = useState<TaskSort>("status");
  const counts = countTasks(workspace.items);
  const { total } = counts;
  const completed = counts.byStatus.done;
  const progress = total ? Math.round((completed / total) * 100) : 0;
  const itemCounts = workspace.items.reduce<Record<string, number>>((counts, item) => {
    counts[item.workstreamId] = (counts[item.workstreamId] ?? 0) + 1;
    return counts;
  }, {});
  const streamItems = selectedWorkstreamId
    ? workspace.items.filter((item) => item.workstreamId === selectedWorkstreamId)
    : workspace.items;
  const visibleItems = sortTasks(filterByPriority(streamItems, priorityFilter), taskSort);
  const queuedIds = new Set(workspace.focusQueue);
  const queueItems = workspace.focusQueue
    .map((id) => workspace.items.find((item) => item.id === id))
    .filter((item): item is Workspace["items"][number] => item !== undefined);
  const queueCandidates = sortTasks(
    workspace.items.filter((item) => item.status !== "done" && !queuedIds.has(item.id)),
    "priority",
  );
  const toggleQueue = (itemId: string, queued: boolean) => (queued ? enqueueItem(itemId) : dequeueItem(itemId));
  const showsTasks = viewMode === "list" || viewMode === "board";
  const visibleActivity = selectedWorkstreamId
    ? workspace.activity.filter((entry) =>
      entry.workstreamId === selectedWorkstreamId ||
      (entry.entityType === "workstream" && entry.entityId === selectedWorkstreamId))
    : workspace.activity;
  const selectedWorkstreamName = selectedWorkstreamId
    ? workspace.workstreams.find((stream) => stream.id === selectedWorkstreamId)?.name
    : undefined;
  const today = new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date());

  return (
    <>
        <section className="welcome">
          <div className="welcome-copy">
            <p className="eyebrow">{today.toUpperCase()} <span className="sun-separator">✳</span> YOUR PERSONAL WORKSPACE</p>
            <h1>Make today<br /><em>count.</em></h1>
            <p className="welcome-subtitle">A little clarity goes a long way. Here’s what’s on your plate.</p>
          </div>
          <div className="sun-card" aria-label={`${progress}% of tasks complete`}>
            <div className="sun-orbit"><span className="sun-core">✳</span></div>
            <span className="sun-caption">YOUR DAY, IN GOOD SHAPE</span>
            <strong>{progress}<small>%</small></strong>
            <span className="sun-footnote">{completed} of {total} wrapped up</span>
          </div>
        </section>

        <section className="summary-strip" aria-label="Today at a glance">
          <div className="summary-item">
            <span className="summary-icon mango" aria-hidden="true">✳</span>
            <div><strong>{pad(counts.byStatus.todo)}</strong><span>UP NEXT</span></div>
          </div>
          <div className="summary-divider" />
          <div className="summary-item">
            <span className="summary-icon coral" aria-hidden="true">➤</span>
            <div><strong>{pad(counts.byStatus.doing)}</strong><span>IN MOTION</span></div>
          </div>
          <div className="summary-divider" />
          <div className="summary-item">
            <span className="summary-icon tomato" aria-hidden="true">↗</span>
            <div><strong>{pad(completed)}</strong><span>ALREADY DONE</span></div>
          </div>
          <div className="summary-divider" />
          <div className="summary-priorities" aria-label="Open tasks by priority">
            <span className="summary-priorities-label">OPEN BY PRIORITY</span>
            {priorities.map((level) => (
              <span className={`summary-priority priority-${level.toLowerCase()}`} key={level}>
                <i aria-hidden="true" />{level} <strong>{counts.openByPriority[level]}</strong>
              </span>
            ))}
          </div>
          <div className="summary-aside"><span>✦</span> One thing at a time.</div>
        </section>

        <WorkstreamBar
          workstreams={workspace.workstreams}
          itemCounts={itemCounts}
          selectedId={selectedWorkstreamId}
          onSelect={setSelectedWorkstreamId}
          onAdd={addWorkstream}
          onToggleStatus={toggleWorkstreamStatus}
        />

        <div className="content-grid">
          <section className="work-panel">
            <div className="section-heading task-heading">
              <div>
                <p className="eyebrow">
                  {viewMode === "history" ? "EVERY MOVE, ON RECORD" : viewMode === "queue" ? "WHAT’S NEXT, IN ORDER" : "THE MAIN EVENT"}
                </p>
                <h2>
                  {viewMode === "history"
                    ? `${selectedWorkstreamName ? `${selectedWorkstreamName} history` : "Activity history"}`
                    : viewMode === "queue"
                      ? "Focus queue"
                      : selectedWorkstreamName ?? "Your task list"}
                  {" "}
                  <span className="list-count">
                    {viewMode === "history" ? visibleActivity.length : viewMode === "queue" ? queueItems.length : visibleItems.length}
                  </span>
                </h2>
              </div>
              <div className="view-switch" role="group" aria-label="Task layout">
                <button
                  type="button"
                  className={viewMode === "list" ? "selected" : ""}
                  onClick={() => setViewMode("list")}
                  aria-pressed={viewMode === "list"}
                >
                  <span aria-hidden="true">☰</span> List
                </button>
                <button
                  type="button"
                  className={viewMode === "board" ? "selected" : ""}
                  onClick={() => setViewMode("board")}
                  aria-pressed={viewMode === "board"}
                >
                  <span aria-hidden="true">▦</span> Board
                </button>
                <button
                  type="button"
                  className={viewMode === "queue" ? "selected" : ""}
                  onClick={() => setViewMode("queue")}
                  aria-pressed={viewMode === "queue"}
                >
                  <span aria-hidden="true">≡</span> Queue{queueItems.length > 0 && <span className="view-badge">{queueItems.length}</span>}
                </button>
                <button
                  type="button"
                  className={viewMode === "history" ? "selected" : ""}
                  onClick={() => setViewMode("history")}
                  aria-pressed={viewMode === "history"}
                >
                  <span aria-hidden="true">◷</span> History
                </button>
              </div>
            </div>
            {showsTasks && (
              <>
                <TaskComposer workstreams={workspace.workstreams} onAdd={addItem} />
                <TaskToolbar
                  priority={priorityFilter}
                  sort={taskSort}
                  shown={visibleItems.length}
                  total={streamItems.length}
                  onPriorityChange={setPriorityFilter}
                  onSortChange={setTaskSort}
                />
              </>
            )}
            {viewMode === "list" && (
              <>
                <TaskList items={visibleItems} queuedIds={queuedIds} onToggle={toggleItem} onToggleQueue={toggleQueue} />
                <div className="list-footer"><span>SMALL STEPS. REAL MOMENTUM.</span><span>{completed}/{total} COMPLETE</span></div>
              </>
            )}
            {viewMode === "board" && (
              <BoardView
                items={visibleItems}
                workstreams={workspace.workstreams}
                queuedIds={queuedIds}
                onMove={setItemStatus}
                onToggleQueue={toggleQueue}
              />
            )}
            {viewMode === "queue" && (
              <QueueView
                items={queueItems}
                candidates={queueCandidates}
                workstreams={workspace.workstreams}
                onMove={moveInQueue}
                onRemove={dequeueItem}
                onAdd={enqueueItem}
                onStart={(itemId) => setItemStatus(itemId, "doing")}
                onComplete={(itemId) => setItemStatus(itemId, "done")}
              />
            )}
            {viewMode === "history" && (
              <HistoryView entries={visibleActivity} workstreams={workspace.workstreams} />
            )}
          </section>

          <ActivityFeed entries={visibleActivity} onOpenHistory={() => setViewMode("history")} />
        </div>
    </>
  );
}

function pad(value: number): string {
  return value.toString().padStart(2, "0");
}
