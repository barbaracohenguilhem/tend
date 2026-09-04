# tend · Smart Inbox

The phone app for the studio's Notion **Smart Inbox**: LOLI files action items from email into Notion, and tend is where
Carla decides, Barbara executes, and each team member sees and handles what is in their name.

Live: https://tendys.netlify.app — sign in with an `@carlaguilhem.com` address and the team password shown on the screen,
then on the iPhone use Share → **Add to Home Screen**.

## How it is deployed

GitHub `main` → Netlify builds `app/` (`netlify.toml`: base `app`, `npm run vercel-build` = icons + type-check + Vite build,
publish `dist`, `VITE_API_BASE=/api`). The Notion integration token lives only in the Netlify environment; the phone
never sees it. The API is one serverless function (`netlify/functions/api.mjs`) that wraps the host-neutral core in `api/`.

Environment variables (Netlify → Site configuration → Environment variables):

| Variable | Required | What it does |
| --- | --- | --- |
| `NOTION_TOKEN` | yes | Internal integration token with access to the Smart Inbox database. |
| `NOTION_DATA_SOURCE_ID` | no | The Smart Inbox *data source* (table) inside the Notion database (default `3ce2004f-2880-8038-950e-000be59b4c02`). A Notion database can hold several tables; the API always reads and writes this one, so another table added to the database cannot break the app. |
| `TEAM_PASSWORD` | no | The shared password (default `APPCONTROLE`). The sign-in screen asks the server, so changing it here is enough; update the hint in `src/lib/auth.ts` when you do. |
| `ALLOWED_DOMAIN` | no | Email domain allowed to sign in (default `carlaguilhem.com`). |

`vercel.json` and `api/smart-inbox/*.js` keep the same API deployable on Vercel; they are not used by the Netlify site.

## Who sees what

Roles come from the roster in `src/lib/team.ts` (mirrored in `api/_lib.js`); addresses not on the roster can sign in
but own nothing until they are added.

- **Carla** (`design@`) — Home: *Your team asks* (Approve / No with a reply), *To decide* (LOLI proposals for her own
  tasks), *To deliver*, *Also in your name*, *Sent back*, *Team proposals* (LOLI proposals for the team's tasks, which
  also wait for her approval), *Quick checks*. Board (Today /
  Tomorrow / Later / No date), Calendar, Today, Review, chat, forwarding, field editing, subtasks and dependencies.
- **Barbara** (`bc@`) — Home: *Approved — for you to do*, *Handed to you*, *Rejected — with her reason*, *Needs an owner*
  (LOLI could not tell whose), *Team waiting on Carla*, *She did it herself* (struck). Same manager tools.
- **Team** — only tasks filed under their own name, on the server as well as in the app. They can complete, change the date,
  snooze, delegate to a teammate with a note, *Ask Carla to confirm* (text, links, attachments), add subtasks and
  dependencies to their own tasks, and quick-add tasks for themselves.

## Task titles

LOLI's "Next action" is a full sentence (often 80–200 characters), too long to scan on a phone. The app shows the Notion
**Title** property instead — a short, direct title (verb + object + the name the team recognises, no dates, no parentheses) —
and keeps the full sentence on the task's own screen. When a task has no title yet (LOLI has just filed it), `src/lib/title.ts`
shortens the sentence itself: it drops parentheses and preambles, cuts before a second verb, a purpose clause, a deadline or a
caveat, and caps the result at 64 characters; for LOLI's generic boilerplate ("Revisar o e-mail e executar a ação solicitada")
it falls back to the cleaned e-mail subject. Managers can write titles for the whole inbox through `POST /update` with
`patch: { title }`.

## Data and sync

`src/store/useInbox.ts` reads `GET /api/smart-inbox` (open items plus anything completed in the last week, polled every
60 s and on return to the app) and writes through `/update`, `/create`, `/comments`, `/upload`. Every change is applied
optimistically and queued in `localStorage` per signed-in person; sends go out one at a time in order, replay when the
phone is back online, and a change Notion refuses outright is dropped with a message instead of blocking the queue.
Undo of a quick-add archives the Notion page if it was already created. A small service worker (`public/sw.js`) keeps
the app shell available offline; `/api` is never cached.

Due dates with a time are stored in Notion with an offset and shown in the phone's own time zone.

The server speaks Notion API version `2025-09-03` and addresses the Smart Inbox *data source* directly
(`api/_core.js`; the id lives in `api/_lib.js`). Older versions query the database as a whole and stop working ("this database has multiple data
sources") the moment a second table is added to it in Notion — which is what took the app down on 3 Sept 2026.

## Run it locally

```bash
cd app
npm install
npm run dev          # http://localhost:5173 — uses public/smart-inbox.json (demo data) and queues writes
npm run build        # type-checks, then writes dist/
VITE_API_BASE=/api npx vite build --outDir dist-vercel   # the hosted bundle (needs the API next to it)
```

To run the hosted bundle against a fake Notion end to end, see the Playwright harnesses used during development
(`stage*-e2e.mjs`): they start `netlify/functions/api.mjs` in-process with `NOTION_API_BASE` pointing at a local stub.

## Layout

```
app/
  api/                    _core.js (routes), _lib.js (Notion mapping, roster), _http.js (adapters), smart-inbox/ (Vercel)
  netlify/functions/      api.mjs — the Netlify function
  public/                 manifest, icons, sw.js, smart-inbox.json (demo data only)
  src/
    App.tsx               session, role scoping, handlers, undo
    lib/                  types, team roster, auth, dates, quick-add parser, weight (decision vs quick check), api
    store/                useInbox (data + queue), useComments, useSettings, useToast
    components/           TaskList, TabBar, FieldEditor, TaskTags, Chat, Avatar, icons
    screens/              Gate, Home, Board, Calendar, List (Today/Week/Owner), Review, Detail, Focus, Done, QuickAdd, Settings
    styles/               aura.css (design tokens), app.css
```

## The e-mail robot

The robot replaces the Notion agent ("LOLI"): it reads the studio's mailboxes, classifies every e-mail with Claude Opus 5
following the Smart Inbox rules (`api/loli/prompt.mjs` carries the property descriptions, the roster and the house style),
writes the row into Notion and rewrites a proposal when Carla marks it *Changes requested*. It runs on Netlify:

- `netlify/functions/loli-tick.mjs` — scheduled every minute, starts the worker.
- `netlify/functions/loli-run-background.mjs` — the worker (background function, up to 15 minutes): for each mailbox, new
  INBOX messages since the last cursor (IMAP with an app password, read-only, never marks mail as read), at most 8 per run;
  then the revision loop. State (cursors, lock, run log) lives in Netlify Blobs.
- `netlify/functions/loli-status.mjs` — `GET /.netlify/functions/loli-status?key=<team password>` shows configuration,
  cursors, the last runs, the cost so far, the newest on-demand classifications and the last network probe.
- `netlify/functions/loli-classify-background.mjs` — `POST` one e-mail as JSON (`x-loli-key`) to classify it on demand;
  `write: true` also creates the row. Results appear in `loli-status` under `classified`.
- `netlify/functions/loli-net-background.mjs` — network probe (`?mode=handshake` per address, or `?mode=messages` for
  tiny real calls through the configured route); the last run appears in `loli-status` under `net`.
- `api/loli/` — `gmail.mjs` (IMAP + parsing), `brain.mjs` (Claude, structured output, PDF/image attachments read
  directly), `notion.mjs` (rows, thread dedup, page body, meeting summaries), `run.mjs` (the pass), `state.mjs`.

Behaviour worth knowing: a reply on a thread whose row is still open and not yet approved refreshes that row instead of
creating a duplicate; the e-mail text is stored in the page so the revision loop can reread it; an e-mail that fails
three runs in a row is skipped and reported in the run log; the first run starts from the beginning of the current day
(`LOLI_SINCE` to change).

Environment variables (Netlify → Site configuration → Environment variables):

| Variable | Required | What it does |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | yes | Claude API key (`sk-ant-…`, from console.anthropic.com) — calls go straight to the Anthropic API at list price. If none is set, Netlify injects its own key and `ANTHROPIC_BASE_URL` (`…/.netlify/ai`) and the calls go through the **Netlify AI Gateway**: billed to the Netlify account (1 USD of model usage = 180 credits, about 20 % over list price when credits are bought) and throttled per minute (free plan ≈ 18k tokens/min, i.e. about two e-mails a minute; the robot waits and retries when throttled). `loli-status` shows which route is in use under `configured.route`. |
| `LOLI_GMAIL_1_USER`, `LOLI_GMAIL_1_PASS` | yes | First mailbox and its Gmail app password (2-step verification on). `_2_`, `_3_`… add more. `LOLI_MAILBOXES` (JSON `[{user,password}]`) also works. |
| `LOLI_DATA_SOURCE_ID` | no | Where rows are written. Default: the shadow copy "Smart Inbox (teste do robô)" (`d8a913b6-15ad-4c9c-beff-27e4c5188336`). Set to `3ce2004f-2880-8038-950e-000be59b4c02` for the real Smart Inbox when switching over. |
| `LOLI_MEETING_DATA_SOURCE_ID` | no | Meeting summaries database (default the existing one). |
| `LOLI_MODEL`, `LOLI_EFFORT` | no | Default `claude-opus-5`, `high`. |
| `LOLI_ANTHROPIC_BASE_URL` | no | Forces the API base URL (normally not needed: a `sk-ant-` key already goes to `https://api.anthropic.com`). |
| `LOLI_RUN_KEY` | no | Key for the worker and status endpoints (default: the team password). |
| `LOLI_ENABLED` | no | `false` pauses the robot without removing anything. |
| `LOLI_SINCE` | no | ISO date for the first run's starting point. |

Switching over from LOLI: run in shadow (default) against the copy, compare with LOLI's rows, then set
`LOLI_DATA_SOURCE_ID` to the real Smart Inbox and pause the two Notion agents ("Classificador Gmail → Notion").
The Notion integration must be connected to whichever database the robot writes to.
