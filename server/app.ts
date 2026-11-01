import express, { type Express, type Request, type Response } from "express";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { applyCommand, findCommandTarget, parseCommand } from "../src/domain/commands.ts";
import type { WorkspaceStore } from "./db.ts";

/**
 * HTTP API. The client reads the workspace and sends commands; the server
 * applies them with the shared pure operations and persists the result.
 */

export interface AppOptions {
  store: WorkspaceStore;
  /** Directory with the built client (served when present). */
  staticDir?: string;
}

export function createApp({ store, staticDir }: AppOptions): Express {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "2mb" }));

  app.get("/api/health", (_request, response) => {
    response.json({ ok: true });
  });

  app.get("/api/workspace", (_request, response) => {
    response.json({ workspace: store.load() });
  });

  app.post("/api/commands", (request, response) => {
    const parsed = parseCommand(request.body);
    if (!parsed.ok) {
      response.status(400).json({ error: parsed.error });
      return;
    }
    const workspace = store.load();
    const problem = findCommandTarget(workspace, parsed.command);
    if (problem) {
      response.status(404).json({ error: problem });
      return;
    }
    const next = applyCommand(workspace, parsed.command);
    if (next !== workspace) store.save(next);
    response.json({ workspace: next });
  });

  app.use("/api", (_request: Request, response: Response) => {
    response.status(404).json({ error: "Not found." });
  });

  if (staticDir && existsSync(staticDir)) {
    const index = resolve(staticDir, "index.html");
    app.use(express.static(staticDir));
    app.use((request, response, next) => {
      if (request.method !== "GET" || request.path.startsWith("/api")) return next();
      response.sendFile(index);
    });
  }

  return app;
}
