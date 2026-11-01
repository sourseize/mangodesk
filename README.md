Mango Desk is a local work cockpit for answering one question at a glance:
**what's happening, and what should I do next?** A small server on your own
machine keeps the workspace in a SQLite database; the browser UI talks to it
over a local API. No account, no cloud.
The interface uses a lively mango, tomato, leaf, and warm-paper palette instead
of the usual blue-violet SaaS look.

## Features

- **Daily list, board and workstreams** — capture tasks, move them through
  Up next → In motion → Done, and keep them in lanes. Long lists are paged.
- **Focus queue** — line up what you'll do next and reorder it by dragging
  or from the keyboard (focus a row: `u`/`d` move, `U`/`D` top/bottom, `↑`/`↓`
  navigate, `Enter` start, `Space` complete, `Delete` remove). Completed tasks
  leave the queue on their own; every queue change is in the history.
- **Activity history** — an audit trail of what *you* did (tasks added and
  moved, queue changes, workstreams created/paused/resumed) with before → after values.
  Filter by text, action and date range, scope to a workstream, and export
  the result as JSON. The most recent 1,000 events are kept. This is a record
  of user actions, not input tracking.

## Requirements

Node.js 22 (see `engines` in `package.json`) and npm. The server uses Node's
built-in TypeScript and SQLite support, so there is nothing else to install.

## Build and run

```sh
npm install          # install dependencies
npm start            # API server (:3001) + client dev server (:5173) with hot reload
npm run build        # type-check and produce a production build in dist/
npm run serve        # serve the production build and the API from one process (:3001)
```

The database lives in `data/mango-desk.sqlite` (set `MANGO_DESK_DB` to change
it; `PORT` changes the server port).

## Test

```sh
npm test             # unit, component and API tests (Vitest)
npm run test:watch   # re-run on change
npm run typecheck    # tsc only
```

## Test data

A deterministic generator (`src/devtools/seedData.ts`) can fill the database
with realistic data for manual, smoke and regression testing. Seeding is done
on the server only — the client cannot load, switch or remove test data. Your
own workspace is backed up before seeding and restored when you clear.

```sh
npm run seed -- demo     # 40 tasks, 6 workstreams, two weeks of history
npm run seed -- large    # 400 tasks, 8 workstreams, two months of history
npm run seed -- status   # is seed data active?
npm run seed -- clear    # remove seed data and restore the backup
```

The seed command can run while the server is up; reload the page to see the
result. Tests use `generateSeedWorkspace(...)` directly and never touch the
database file.
