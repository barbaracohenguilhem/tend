import { people } from '../lib/people';
import type { OwnerId, Priority, RelayOp, Review, Task, TaskPatch } from '../lib/types';
import type { McpError } from '../lib/claude';

/** Connector display name and the Smart Inbox data source (see project/sync-spec.md). */
export const NOTION_SERVER = 'Notion';
export const DATA_SOURCE_ID = '3ce2004f-2880-8038-950e-000be59b4c02';
export const DATA_SOURCE_URL = `collection://${DATA_SOURCE_ID}`;
export const TOOL_QUERY = 'notion-query-data-sources';
export const TOOL_UPDATE = 'notion-update-page';
export const TOOL_CREATE = 'notion-create-pages';

/** The "Tasks" view without its owner filter: action required, not completed, priority then due. */
export const QUERY_INPUT = {
  data: {
    mode: 'rows',
    data_source_url: DATA_SOURCE_URL,
    limit: 100,
    filter: {
      type: 'group', operator: 'and', filters: [
        { type: 'property', property: 'Action required', propertyType: 'checkbox', operator: 'checkbox_is', value: { type: 'exact', value: true } },
        { type: 'property', property: 'Completed', propertyType: 'checkbox', operator: 'checkbox_is', value: { type: 'exact', value: false } },
      ],
    },
    sort: [{ property: 'Priority', direction: 'ascending' }, { property: 'Due date', direction: 'ascending' }],
  },
};

type Row = Record<string, unknown>;
const str = (v: unknown) => (typeof v === 'string' ? v : '');

/** Rich text from rows mode uses <br> for line breaks and markdown links; flatten for display. */
function plain(v: unknown): string {
  return str(v).replace(/<br\s*\/?>/gi, '\n').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').trim();
}

function ownerId(text: string): OwnerId {
  const t = text.toLowerCase();
  for (const p of people) if (p.keys.some(k => t.includes(k))) return p.id;
  return 'none';
}

const priorities: Priority[] = ['High', 'Medium', 'Low'];
const reviews: Review[] = ['Pending review', 'Approved', 'Changes requested', 'Barbara to handle'];

export function pageIdFromUrl(url: string): string {
  const m = url.match(/([0-9a-f]{32})/i);
  return m ? m[1] : url;
}

function localTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function rowToTask(row: Row): Task {
  const dueStart = str(row['date:Due date:start']);
  const isDatetime = row['date:Due date:is_datetime'] === 1;
  const p = str(row['Priority']), r = str(row['Carla review']);
  const subject = plain(row['Subject']);
  const action = plain(row['Next action']) || subject;
  const draft = plain(row['Response / action for approval']);
  return {
    id: pageIdFromUrl(str(row['url'])),
    action, subject,
    from: plain(row['From']) || plain(row['Sender email']),
    owner: ownerId(str(row['Owner'])),
    priority: priorities.includes(p as Priority) ? (p as Priority) : null,
    category: str(row['Category']) || 'Action required',
    review: reviews.includes(r as Review) ? (r as Review) : null,
    draft: draft || null,
    feedback: plain(row['Carla feedback']) || null,
    summary: plain(row['Summary']),
    gmail: str(row['Gmail link']) || null,
    due: dueStart ? (isDatetime ? localIsoDate(dueStart) : dueStart.slice(0, 10)) : null,
    time: dueStart && isDatetime ? localTime(dueStart) : null,
    completed: row['Completed'] === '__YES__',
  };
}

function localIsoDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** "YYYY-MM-DDTHH:MM:00±HH:MM" in the phone's zone, so Notion keeps the intended wall-clock time. */
function localDateTime(date: string, time: string): string {
  const off = -new Date(`${date}T${time}:00`).getTimezoneOffset();
  const sign = off >= 0 ? '+' : '-', a = Math.abs(off);
  return `${date}T${time}:00${sign}${String(Math.floor(a / 60)).padStart(2, '0')}:${String(a % 60).padStart(2, '0')}`;
}

function ownerName(id: OwnerId): string {
  const p = people.find(x => x.id === id);
  return p && p.id !== 'none' ? p.name : 'Not identified';
}

/** Task patch → Notion property map (SQLite naming from the data source schema). */
export function patchToProperties(patch: TaskPatch, current?: Task): Record<string, unknown> {
  const props: Record<string, unknown> = {};
  if (patch.completed !== undefined) props['Completed'] = patch.completed ? '__YES__' : '__NO__';
  if (patch.review !== undefined) props['Carla review'] = patch.review;
  if (patch.feedback !== undefined) props['Carla feedback'] = patch.feedback ?? '';
  if (patch.draft !== undefined) props['Response / action for approval'] = patch.draft ?? '';
  if (patch.priority !== undefined) props['Priority'] = patch.priority ?? 'No priority';
  if (patch.owner !== undefined) props['Owner'] = ownerName(patch.owner);
  if (patch.due !== undefined || patch.time !== undefined) {
    const due = patch.due !== undefined ? patch.due : current?.due ?? null;
    const time = patch.time !== undefined ? patch.time : current?.time ?? null;
    if (!due) { props['date:Due date:start'] = null; }
    else if (time) { props['date:Due date:start'] = localDateTime(due, time); props['date:Due date:is_datetime'] = 1; }
    else { props['date:Due date:start'] = due; props['date:Due date:is_datetime'] = 0; }
  }
  return props;
}

export function createInput(op: Extract<RelayOp, { kind: 'create' }>, from: string) {
  const props: Record<string, unknown> = {
    'Subject': op.action, 'Next action': op.action, 'From': from, 'Owner': ownerName(op.owner),
    'Category': 'Action required', 'Action required': '__YES__', 'Completed': '__NO__',
    'Priority': op.priority ?? 'No priority',
  };
  if (op.due) { props['date:Due date:start'] = op.due; props['date:Due date:is_datetime'] = 0; }
  return { parent: { type: 'data_source_id', data_source_id: DATA_SOURCE_ID }, pages: [{ properties: props }] };
}

export const AUTHZ_CODES = ['needs_reauth', 'server_not_connected', 'blocked_by_policy', 'approval_required', 'not_granted', 'capability_disabled', 'capability_removed', 'not_in_manifest', 'selection_required'];

/** Viewer-facing copy per error code — each names the fix. */
export function describeMcpError(e: McpError | undefined): string {
  switch (e?.code) {
    case 'needs_reauth': return 'Reconnect Notion in claude.ai Settings → Connectors.';
    case 'server_not_connected': return 'Add Notion in claude.ai Settings → Connectors.';
    case 'selection_required': return 'Choose which Notion connector this page should use.';
    case 'not_granted': case 'capability_disabled': case 'capability_removed': return 'Open this page inside claude.ai to connect to Notion.';
    case 'blocked_by_policy': return 'Your organisation blocks this Notion tool.';
    case 'approval_required': return 'This Notion action needs approval from your organisation.';
    case 'server_unavailable': return 'Notion is not responding right now.';
    case 'rate_limited': return 'Too many requests — try again in a moment.';
    case 'tool_error': return e?.message ? `Notion said: ${e.message}` : 'Notion rejected the change.';
    case 'cancelled': return 'Cancelled.';
    default: return e?.message || 'Could not reach Notion.';
  }
}
