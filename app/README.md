# tend · Smart Inbox

The phone app from `project/Smart Inbox.dc.html`, built as an installable React PWA.
Today lists every open action item from the Notion **Smart Inbox** database (Carla first, then the team);
Review holds LOLI's drafts waiting for a decision; a Carla ↔ Barbara switch shows each person their view.

## Run it

```bash
cd app
npm install
npm run dev        # http://localhost:5173 — open on your phone via the LAN URL Vite prints
npm run build      # type-checks, then writes a static site to dist/
npm run preview    # serves dist/ locally
```

Deploy `dist/` anywhere static (Vercel, Netlify, Cloudflare Pages — zero config; framework preset "Vite").
On the iPhone: open the URL in Safari → Share → **Add to Home Screen**. It launches full-screen with the
status bar and home indicator handled via safe-area insets. On a desktop browser it renders inside the
402×874 iPhone frame from the design so it can be compared against the mockup.

## Publishing as a claude.ai page (the way it is deployed today)

```bash
npm run build:artifact     # writes dist/tend-artifact.html — one self-contained HTML fragment
```

Publish that file as a claude.ai Artifact with the `mcp` capability declared for the Notion connector
(tools `notion-query-data-sources`, `notion-update-page`, `notion-create-pages`). Inside claude.ai the page
talks to the viewer's own Notion connection — no relay, no token, nothing to host. The page is private to the
account that published it until it is shared from its share menu. On the iPhone, open the link in Safari and
use Share → Add to Home Screen.

Live page: https://claude.ai/code/artifact/d568c62e-8e2a-48a5-a0ed-8b1796658d82

## Data and sync

Inside claude.ai the store (`src/store/useInbox.ts`, `src/store/notion.ts`) queries the Smart Inbox data
source directly (rows mode, first 100 open items, polled every 60 s) and writes property updates and new pages
back through the connector. Self-hosted, it instead reads and writes through the relay described in
`../project/sync-spec.md` (n8n, or the same shape in Make/Zapier).

Tap the **tend** logo on any screen (or the "n waiting for relay" pill) to open **Sync** settings:

| Setting | What it does |
| --- | --- |
| Data URL | `GET` endpoint returning `{ fetchedAt, items }`. Defaults to the bundled snapshot `public/smart-inbox.json` (the "Tasks" view from 3 Sept). A remote URL is polled every 60 s and on return to the app. |
| Relay URL | `POST` base. Write-backs go to `<relay>/smart-inbox/update` and `<relay>/smart-inbox/create` with `actor: "carla" \| "barbara"`. |
| Relay key | Sent as the `x-relay-key` header on every request. |
| Header aura | The peach bloom behind the Today header. |

Settings are stored per device (`localStorage`), so Carla's phone and Barbara's phone each keep their own mode
and relay configuration.

**Offline / no relay yet.** Every change is applied optimistically and queued. While the relay URL is empty
or unreachable, the header shows "n waiting for relay"; the queue survives reloads and is replayed on top of
each fresh snapshot, then sent in order as soon as a relay URL is set, the phone comes back online, or you tap
**Send queued** in Sync. Tasks added with the quick-add sheet live locally until the relay creates them in Notion
and they come back in the snapshot.

**CORS.** Because the app sends JSON and the `x-relay-key` header, the relay's webhooks must answer the
`OPTIONS` preflight with `Access-Control-Allow-Origin` (your app's origin), `Access-Control-Allow-Headers:
content-type, x-relay-key` and `Access-Control-Allow-Methods: GET, POST, OPTIONS`. In n8n, enable
"Allowed Origins (CORS)" on the Webhook node or add a Respond-to-Webhook branch for `OPTIONS`.

## What's implemented

- **Today** — open items grouped by owner (Carla, Fernanda, Luiz, Alessandra, Nicola, Unassigned), sorted by priority then due date; owner filter chips; High badge; review status pill; Completed section.
- **Carla ↔ Barbara** — Barbara sees only approved / handed-off items ("Handoff.") with *Mark completed*.
- **Review** — LOLI's drafts with Approve, Changes + feedback (sent back to LOLI), To Barbara, inline draft editing, summary toggle, Show more, LOLI's limitation note, Open in Gmail; Decided section.
- **Week** — Monday-based day strip with dots, per-day list, undated items.
- **People** — per-owner cards with open/high counts and completion bar → Owner screen.
- **Task detail** — slide-in; tap Owner / Priority / Due to cycle; Later today / Tomorrow / Next week; Mark completed / Reopen.
- **Gestures** — swipe right = done, swipe left = tomorrow, hold the grip to reorder (local order only), tap the circle to complete.
- **Focus** — one task at a time with Done / Tomorrow / Skip; drifting aura.
- **Quick add** — natural language: `Send GA files to Unzile tomorrow 9am @Fernanda high`; chips to override date, owner, priority.
- **Inbox clear** — celebration screen when nothing is left open.
- Toasts with **Undo** for complete, snooze, review decisions and adds.

## Layout

```
app/
  index.html               PWA meta, manifest, icons
  public/
    smart-inbox.json       bundled snapshot (copy of ../project/smart-inbox.json)
    manifest.webmanifest, icon.svg, apple-touch-icon.png, icon-512.png
  src/
    App.tsx                screen state, actions, undo
    lib/                   types, people & category colours, dates, sorting, quick-add parser, storage
    store/                 useSettings (Sync settings), useInbox (snapshot + relay queue), useToast
    components/            TaskList (swipe/drag), TabBar, Avatar, ReviewPill, Toast, icons
    screens/               ListScreen (Today/Week/Owner), Review, People, Detail, Focus, Done, QuickAdd, Settings
    styles/aura.css        the Aura design tokens from the handoff, verbatim
    styles/app.css         every style from the mockup, as classes
```

Fonts are the Aura substitutes (Newsreader / Manrope) loaded from Google Fonts by `aura.css`.
