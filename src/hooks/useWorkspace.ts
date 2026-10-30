import { useEffect, useState } from "react";
import {
  createId,
  type ActivityEntry,
  type Priority,
  type WorkItem,
  type WorkStatus,
  type Workstream,
  type Workspace,
} from "../domain/workspace";
import { loadWorkspace, saveWorkspace } from "../storage/workspaceStorage";

export function useWorkspace() {
  const [workspace, setWorkspace] = useState<Workspace>(loadWorkspace);

  useEffect(() => {
    saveWorkspace(workspace);
  }, [workspace]);

  function addItem(title: string, priority: Priority, workstreamId: string) {
    const item: WorkItem = {
      id: createId(),
      title,
      priority,
      workstreamId,
      status: "todo",
      createdAt: new Date().toISOString(),
    };
    updateWithActivity(item, "created");
  }

  function toggleItem(itemId: string) {
    setItemStatus(itemId, workspace.items.find((item) => item.id === itemId)?.status === "done" ? "todo" : "done");
  }

  function setItemStatus(itemId: string, status: WorkStatus) {
    setWorkspace((current) => {
      const item = current.items.find((candidate) => candidate.id === itemId);
      if (!item || item.status === status) return current;
      const updated = { ...item, status };
      return {
        ...current,
        items: current.items.map((candidate) => candidate.id === itemId ? updated : candidate),
        activity: [makeActivity(updated.title, activityKindFor(status)), ...current.activity],
      };
    });
  }

  function addWorkstream(name: string, color: Workstream["color"]) {
    const workstream: Workstream = {
      id: createId(),
      name,
      color,
      status: "active",
    };
    setWorkspace((current) => ({
      ...current,
      workstreams: [...current.workstreams, workstream],
    }));
  }

  function toggleWorkstreamStatus(workstreamId: string) {
    setWorkspace((current) => ({
      ...current,
      workstreams: current.workstreams.map((workstream) =>
        workstream.id === workstreamId
          ? { ...workstream, status: workstream.status === "active" ? "paused" : "active" }
          : workstream,
      ),
    }));
  }

  function updateWithActivity(item: WorkItem, kind: ActivityEntry["kind"]) {
    setWorkspace((current) => ({
      ...current,
      items: [item, ...current.items],
      activity: [makeActivity(item.title, kind), ...current.activity],
    }));
  }

  return { workspace, addItem, toggleItem, setItemStatus, addWorkstream, toggleWorkstreamStatus };
}

function activityKindFor(status: WorkStatus): ActivityEntry["kind"] {
  if (status === "doing") return "started";
  if (status === "done") return "completed";
  return "reopened";
}

function makeActivity(itemTitle: string, kind: ActivityEntry["kind"]): ActivityEntry {
  return {
    id: createId(),
    itemTitle,
    kind,
    occurredAt: new Date().toISOString(),
  };
}
