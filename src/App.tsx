import { useState } from "react";
import { ActivityFeed } from "./components/ActivityFeed";
import { BoardView } from "./components/BoardView";
import { TaskComposer } from "./components/TaskComposer";
import { TaskList } from "./components/TaskList";
import { WorkstreamBar } from "./components/WorkstreamBar";
import { useWorkspace } from "./hooks/useWorkspace";

export default function App() {
  const { workspace, addItem, toggleItem, setItemStatus, addWorkstream, toggleWorkstreamStatus } = useWorkspace();
  const [selectedWorkstreamId, setSelectedWorkstreamId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "board">("list");
  const completed = workspace.items.filter((item) => item.status === "done").length;
  const total = workspace.items.length;
  const remaining = total - completed;
  const progress = total ? Math.round((completed / total) * 100) : 0;
  const itemCounts = workspace.items.reduce<Record<string, number>>((counts, item) => {
    counts[item.workstreamId] = (counts[item.workstreamId] ?? 0) + 1;
    return counts;
  }, {});
  const visibleItems = selectedWorkstreamId
    ? workspace.items.filter((item) => item.workstreamId === selectedWorkstreamId)
    : workspace.items;
  const today = new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date());

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#" aria-label="Mango Desk home">
          <span className="brand-fruit" aria-hidden="true">✳</span>
          <span>MANGO<span className="brand-light">DESK</span></span>
        </a>
        <div className="topbar-right">
          <span className="offline-indicator"><i /> LOCAL MODE</span>
          <span className="avatar" aria-label="Your workspace">M</span>
        </div>
      </header>

      <main>
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
            <div><strong>{remaining.toString().padStart(2, "0")}</strong><span>STILL TO DO</span></div>
          </div>
          <div className="summary-divider" />
          <div className="summary-item">
            <span className="summary-icon tomato" aria-hidden="true">↗</span>
            <div><strong>{completed.toString().padStart(2, "0")}</strong><span>ALREADY DONE</span></div>
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
                <p className="eyebrow">THE MAIN EVENT</p>
                <h2>{selectedWorkstreamId ? workspace.workstreams.find((stream) => stream.id === selectedWorkstreamId)?.name ?? "Your focus list" : "Your focus list"} <span className="list-count">{visibleItems.length}</span></h2>
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
              </div>
            </div>
            <TaskComposer workstreams={workspace.workstreams} onAdd={addItem} />
            {viewMode === "list" ? (
              <>
                <TaskList items={visibleItems} onToggle={toggleItem} />
                <div className="list-footer"><span>SMALL STEPS. REAL MOMENTUM.</span><span>{completed}/{total} COMPLETE</span></div>
              </>
            ) : (
              <BoardView items={visibleItems} workstreams={workspace.workstreams} onMove={setItemStatus} />
            )}
          </section>

          <ActivityFeed entries={workspace.activity} />
        </div>
      </main>
      <footer className="page-footer"><span>MADE FOR YOUR ACTUAL LIFE</span><span>NO CLOUD. NO NOISE. JUST YOU.</span></footer>
    </div>
  );
}
