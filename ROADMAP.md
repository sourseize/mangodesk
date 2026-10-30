# Mango Desk

## What we're building

Mango Desk is a local-first work cockpit for answering one question at a glance:
**what's happening, and what should I do next?** It runs entirely in the browser,
stores its workspace on this device, and does not need an account or a server.
The interface uses a lively mango, tomato, leaf, and warm-paper palette instead
of the usual blue-violet SaaS look.

## Feature backlog

1. **Today overview (built):** capture work, mark it complete, set its
   importance, see progress, and review a small activity stream. Persist the
   workspace locally.
2. **Workstreams (built):** group tasks by project or area, create color-coded
   streams, pause/activate them, assign tasks, and filter the focus list.
3. **Board view (built):** switch from the focus list to a three-stage board
   and move work through Up next, In motion, and Done.
4. **Activity history (built):** inspect a chronological, searchable history
   filtered by activity type.
5. **Focus queue:** pin a small set of next actions and reorder them.
6. **Search and filters:** find work by title, stream, status, priority, and date.
7. **Labels and notes:** add context to tasks without leaving the local workspace.
8. **Keyboard navigation:** quick capture, search, and common task actions.
9. **Backup and restore:** export/import a human-readable workspace file.
10. **Progress insights:** show completed work and trends over a selected period.
11. **Preferences:** tune accent colors, density, and the start-of-week setting.

We will build this incrementally. Each feature is implemented only after you
approve it, and work pauses again before moving to the next backlog item.

## First slice: implementation notes

- React and TypeScript, built with Vite; Node.js 22 is the target runtime.
- Domain types and persistence are kept separate from UI components.
- The app has no server, account, telemetry, or remote API dependency.
- `localStorage` is the persistence boundary for this first slice.
- Existing saved workspaces are migrated to a default stream when loaded.
- Existing completion flags are migrated to the new three-stage task status.

## Run locally

Use Node.js 22, then run `npm install` and `npm run dev`. Use `npm run build`
to produce the static site in `dist/`; the generated site can be served locally
without an application server or network access.
