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
| `TEAM_PASSWORD` | no | The shared password (default `APPCONTROLE`). The sign-in screen asks the server, so changing it here is enough; update the hint in `src/lib/auth.ts` when you do. |
| `ALLOWED_DOMAIN` | no | Email domain allowed to sign in (default `carlaguilhem.com`). |

`vercel.json` and `api/smart-inbox/*.js` keep the same API deployable on Vercel; they are not used by the Netlify site.

## Who sees what

Roles come from the roster in `src/lib/team.ts` (mirrored in `api/_lib.js`); addresses not on the roster can sign in
but own nothing until they are added.

- **Carla** (`design@`) — Home: *Your team asks* (Approve / No with a reply), *To decide* (every LOLI proposal pending
  review, whoever the task belongs to), *To deliver*, *Also in your name*, *Sent back*, *Quick checks*. Board (Today /
  Tomorrow / Later / No date), Calendar, Today, Review, chat, forwarding, field editing, subtasks and dependencies.
- **Barbara** (`bc@`) — Home: *Approved — for you to do*, *Handed to you*, *Rejected — with her reason*, *Needs an owner*
  (LOLI could not tell whose), *Team waiting on Carla*, *She did it herself* (struck). Same manager tools.
- **Team** — only tasks filed under their own name, on the server as well as in the app. They can complete, change the date,
  snooze, delegate to a teammate with a note, *Ask Carla to confirm* (text, links, attachments), add subtasks and
  dependencies to their own tasks, and quick-add tasks for themselves.

## Data and sync

`src/store/useInbox.ts` reads `GET /api/smart-inbox` (open items plus anything completed in the last week, polled every
60 s and on return to the app) and writes through `/update`, `/create`, `/comments`, `/upload`. Every change is applied
optimistically and queued in `localStorage` per signed-in person; sends go out one at a time in order, replay when the
phone is back online, and a change Notion refuses outright is dropped with a message instead of blocking the queue.
Undo of a quick-add archives the Notion page if it was already created. A small service worker (`public/sw.js`) keeps
the app shell available offline; `/api` is never cached.

Due dates with a time are stored in Notion with an offset and shown in the phone's own time zone.

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
