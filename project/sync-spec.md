# Smart Inbox ↔ tend — sync relay spec (n8n)

The app never talks to Notion directly (CORS + token exposure). An n8n workflow exposes two webhooks; the app polls one and posts to the other. Same shape works in Make/Zapier.

## Source
- Database `3ce2004f28808045a662d5b0314775dc`, data source `collection://3ce2004f-2880-8038-950e-000be59b4c02`
- Filter (the “Tasks” view): `Action required = true`, `Completed = false`
- Owner grouping: `Owner` contains Carla → `carla`; Fernanda → `fernanda`; Luiz | Eduardo → `luiz`; Alessandra → `alessandra`; Nicola → `nicola`; anything else / “Not identified” → `none`
- Sort: Priority (High, Medium, Low, none) then Due date ascending

## GET `/smart-inbox`  (app polls every 60 s; header `x-relay-key`)
Returns `{ fetchedAt, items: [Item] }` — see `smart-inbox.json` for a real sample.

Item ← Notion property
- `id` ← page id · `action` ← Next action · `subject` ← Subject (title)
- `from` ← From · `owner` ← Owner (mapped above) · `priority` ← Priority
- `category` ← Category · `review` ← Carla review (null when empty)
- `draft` ← Response / action for approval · `feedback` ← Carla feedback
- `summary` ← Summary · `gmail` ← Gmail link · `due` ← Due date start (ISO) · `completed` ← Completed

## POST `/smart-inbox/update`   `{ id, patch, actor }`
`actor` is `carla` or `barbara`; the relay writes only the fields below.
- Complete: `{ Completed: true }` (Barbara or Carla)
- Snooze: `{ "date:Due date:start": "YYYY-MM-DD" }`
- Approve: `{ "Carla review": "Approved" }`
- Request changes: `{ "Carla review": "Changes requested", "Carla feedback": text }` → LOLI revises and resets to Pending review
- Hand to Barbara: `{ "Carla review": "Barbara to handle", "Carla feedback": text }`
- Edit draft: `{ "Response / action for approval": text }`
- Reassign: `{ Owner: "Fernanda Britto" }`

Approval never sends email — Barbara performs the external action manually (per the database rules).

## POST `/smart-inbox/create`   `{ action, owner, due, priority }`
Creates a page with `Action required = true`, `Category = Action required`, `Carla review` empty, `Subject = action`.

## App settings (Tweaks)
- `dataUrl` — GET endpoint (defaults to the local `smart-inbox.json` snapshot)
- `relayUrl` — POST base URL; when empty, changes queue locally and the header shows “n changes waiting”
- Poll interval 60 s; optimistic UI, last-write-wins; a failed POST re-queues and shows a toast.
