// Shared helpers for the tend serverless API (Vercel Node functions).
// Talks to the Notion REST API with a server-side integration token; the phone never sees it.

/**
 * The Smart Inbox table inside the Notion database 3ce2004f28808045a662d5b0314775dc. Since Notion API 2025-09-03 a
 * database is a container that can hold several data sources (tables), and the legacy `databases/{id}` query / read /
 * create-page calls fail as soon as it holds more than one — which is exactly what happened when an empty "New data
 * source" appeared next to the Smart Inbox. Every read, write and page creation names this data source explicitly, so
 * extra tables can no longer break the app. Override with NOTION_DATA_SOURCE_ID if the Smart Inbox ever moves.
 */
export const DATA_SOURCE_ID = (process.env.NOTION_DATA_SOURCE_ID || '').trim() || '3ce2004f-2880-8038-950e-000be59b4c02';
const NOTION_API = process.env.NOTION_API_BASE || 'https://api.notion.com';
/** Data-source aware API version (https://developers.notion.com/docs/upgrade-guide-2025-09-03). */
const NOTION_VERSION = '2025-09-03';

const PEOPLE = [
  { id: 'carla', name: 'Carla Guilhem', keys: ['carla'] },
  { id: 'fernanda', name: 'Fernanda Britto', keys: ['fernanda'] },
  { id: 'luiz', name: 'Luiz Eduardo Greco', keys: ['luiz', 'eduardo'] },
  { id: 'alessandra', name: 'Alessandra Lopes', keys: ['alessandra'] },
  { id: 'nicola', name: 'Nicola', keys: ['nicola'] },
  { id: 'eugenia', name: 'Eugenia Galdo', keys: ['eugenia', 'galdo'] },
  { id: 'francesca', name: 'Francesca', keys: ['francesca'] },
  { id: 'yevgeniy', name: 'Yevgeniy Davidenko', keys: ['yevgeniy', 'davidenko'] },
];
export const DEACTIVATED = ['bl@carlaguilhem.com', 'imb@carlaguilhem.com'];
/** Who each address is. Mirrors src/lib/team.ts — keep the two in sync. Unknown addresses at the domain are team members who own nothing. */
export const DIRECTORY = [
  { email: 'design@carlaguilhem.com', name: 'Carla', role: 'carla', owner: 'carla' },
  { email: 'bc@carlaguilhem.com', name: 'Barbara', role: 'barbara', owner: null },
  { email: 'al@carlaguilhem.com', name: 'Alessandra', role: 'team', owner: 'alessandra' },
  { email: 'egreco@carlaguilhem.com', name: 'Eduardo', role: 'team', owner: 'luiz' },
  { email: 'meg@carlaguilhem.com', name: 'Eugenia', role: 'team', owner: 'eugenia' },
  { email: 'fb@carlaguilhem.com', name: 'Fernanda', role: 'team', owner: 'fernanda' },
  { email: 'fc@carlaguilhem.com', name: 'Francesca', role: 'team', owner: 'francesca' },
  { email: 'yd@carlaguilhem.com', name: 'Yevgeniy', role: 'team', owner: 'yevgeniy' },
];
export function userFor(email) {
  const e = String(email || '').trim().toLowerCase();
  const m = DIRECTORY.find(x => x.email === e);
  if (m) return m;
  const local = e.split('@')[0] || 'tend';
  return { email: e, name: local.charAt(0).toUpperCase() + local.slice(1), role: 'team', owner: null };
}
const PRIORITIES = ['High', 'Medium', 'Low'];
const REVIEWS = ['Pending review', 'Approved', 'Changes requested', 'Barbara to handle'];

/** Team gate: shared password + allowed email domain, both checked on every request. */
export function authorize(req, res) {
  const password = process.env.TEAM_PASSWORD || 'APPCONTROLE';
  const domain = (process.env.ALLOWED_DOMAIN || 'carlaguilhem.com').toLowerCase();
  const key = String(req.headers['x-relay-key'] || '').trim();
  const user = String(req.headers['x-user'] || '').trim().toLowerCase();
  if (key.toUpperCase() !== password.toUpperCase()) { res.status(401).json({ error: 'Wrong team password.' }); return false; }
  if (!user.endsWith('@' + domain)) { res.status(401).json({ error: `Only @${domain} addresses can use this app.` }); return false; }
  return true;
}

export function cors(req, res) {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Headers', 'content-type, x-relay-key, x-user');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') { res.status(204).end(); return true; }
  return false;
}

export async function notion(path, body, method = 'POST') {
  const token = process.env.NOTION_TOKEN;
  if (!token) { const e = new Error('NOTION_TOKEN is not set on the server. Add it to the site\'s environment variables (Netlify → Site configuration → Environment variables) and redeploy.'); e.status = 503; throw e; }
  const r = await fetch(`${NOTION_API}/v1/${path}`, {
    method, headers: { Authorization: `Bearer ${token}`, 'Notion-Version': NOTION_VERSION, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    let message = j.message || `Notion responded ${r.status}`;
    // 400 (validation) and 404 (page gone) mean this particular change can never succeed: pass them through so the phone
    // drops it with a message instead of retrying forever and blocking everything queued behind it. Anything else — a bad
    // token (503), rate limiting, conflicts, a Notion outage (502) — is worth retrying later.
    let status = r.status === 400 || r.status === 404 ? r.status : r.status === 401 ? 503 : 502;
    if (r.status === 404 && path.startsWith('data_sources/')) {
      // The table itself is missing: a server configuration problem, not the change's fault — keep the queue waiting.
      message = `Notion cannot find the Smart Inbox table (data source ${DATA_SOURCE_ID}): share the database with the integration again, or set NOTION_DATA_SOURCE_ID to the right data source.`;
      status = 503;
    }
    const e = new Error(message); e.status = status; throw e;
  }
  return j;
}

// ---- Notion page → app item -----------------------------------------------------------
const plain = arr => (Array.isArray(arr) ? arr.map(t => t.plain_text ?? '').join('') : '').trim();
function text(p) { if (!p) return ''; if (p.type === 'title') return plain(p.title); if (p.type === 'rich_text') return plain(p.rich_text); return ''; }
const select = p => (p && p.type === 'select' && p.select ? p.select.name : null);
const checkbox = p => !!(p && p.type === 'checkbox' && p.checkbox);
const url = p => (p && p.type === 'url' && p.url) || null;
const email = p => (p && p.type === 'email' && p.email) || '';
const dateStart = p => (p && p.type === 'date' && p.date && p.date.start) || null;
const relation = p => (p && p.type === 'relation' && Array.isArray(p.relation) ? p.relation.map(r => String(r.id || '').replace(/-/g, '')) : []);
const files = p => (p && p.type === 'files' && Array.isArray(p.files) ? p.files.map(f => ({ name: f.name, url: f.type === 'external' ? f.external?.url : f.file?.url, expires: f.file?.expiry_time || null })).filter(f => f.url) : []);

export function ownerId(s) { const t = (s || '').toLowerCase(); for (const p of PEOPLE) if (p.keys.some(k => t.includes(k))) return p.id; return 'none'; }
export function ownerName(id) { const p = PEOPLE.find(x => x.id === id); return p ? p.name : 'Not identified'; }

export function pageToItem(page) {
  const P = page.properties || {};
  const start = dateStart(P['Due date']);
  const subject = text(P['Subject']);
  const priority = select(P['Priority']), review = select(P['Carla review']);
  return {
    id: String(page.id || '').replace(/-/g, ''),
    action: text(P['Next action']) || subject,
    subject,
    title: text(P['Title']) || null,
    from: text(P['From']) || email(P['Sender email']),
    owner: ownerId(text(P['Owner'])),
    ownerName: text(P['Owner']) || null,
    priority: PRIORITIES.includes(priority) ? priority : null,
    category: select(P['Category']) || 'Action required',
    review: REVIEWS.includes(review) ? review : null,
    draft: text(P['Response / action for approval']) || null,
    feedback: text(P['Carla feedback']) || null,
    summary: text(P['Summary']),
    gmail: url(P['Gmail link']),
    senderEmail: email(P['Sender email']) || null,
    hasAttachments: checkbox(P['Has attachments']),
    resolvedBy: select(P['Resolved by']),
    project: select(P['Project']),
    deliverable: text(P['Deliverable requested']) || null,
    files: files(P['Deliverables']),
    voiceNotes: files(P['Voice notes']),
    teamReview: select(P['Team review']),
    reviewRequest: text(P['Review request']) || null,
    reviewReply: text(P['Review reply']) || null,
    requestedBy: text(P['Requested by']) || null,
    waitingOn: text(P['Waiting on']) || null,
    parentId: relation(P['Parent task'])[0] || null,
    subtaskIds: relation(P['Subtasks']),
    dependsOn: relation(P['Depends on']),
    blocks: relation(P['Blocks']),
    due: start ? start.slice(0, 10) : null,
    time: start && start.length > 10 ? start.slice(11, 16) : null,
    /** Full Notion datetime (with its offset) when the due date has a time; the phone converts it to local time. */
    dueAt: start && start.length > 10 ? start : null,
    completed: checkbox(P['Completed']),
  };
}

// ---- app patch → Notion properties ----------------------------------------------------
const rich = s => ({ rich_text: chunk(s ?? '').map(content => ({ type: 'text', text: { content } })) });
function chunk(s) { const out = []; for (let i = 0; i < s.length; i += 1900) out.push(s.slice(i, i + 1900)); return out.length ? out : ['']; }
const sel = name => ({ select: name ? { name } : null });

/** Local "YYYY-MM-DDTHH:MM:00±HH:MM" from the phone is passed through; a bare date stays a date. */
export function patchToProperties(patch, current) {
  const props = {};
  if (patch.title !== undefined) props['Title'] = rich(patch.title);
  if (patch.completed !== undefined) props['Completed'] = { checkbox: !!patch.completed };
  if (patch.review !== undefined) props['Carla review'] = sel(patch.review);
  if (patch.feedback !== undefined) props['Carla feedback'] = rich(patch.feedback);
  if (patch.draft !== undefined) props['Response / action for approval'] = rich(patch.draft);
  if (patch.priority !== undefined) props['Priority'] = sel(patch.priority || 'No priority');
  if (patch.owner !== undefined) props['Owner'] = rich(ownerName(patch.owner));
  if (patch.resolvedBy !== undefined) props['Resolved by'] = sel(patch.resolvedBy);
  if (patch.project !== undefined) props['Project'] = sel(patch.project);
  if (patch.category !== undefined) props['Category'] = sel(patch.category);
  if (patch.teamReview !== undefined) props['Team review'] = sel(patch.teamReview);
  if (patch.reviewRequest !== undefined) props['Review request'] = rich(patch.reviewRequest);
  if (patch.reviewReply !== undefined) props['Review reply'] = rich(patch.reviewReply);
  if (patch.requestedBy !== undefined) props['Requested by'] = rich(patch.requestedBy);
  if (patch.waitingOn !== undefined) props['Waiting on'] = rich(patch.waitingOn);
  if (patch.parentId !== undefined) props['Parent task'] = { relation: patch.parentId ? [{ id: patch.parentId }] : [] };
  if (patch.dependsOn !== undefined) props['Depends on'] = { relation: (patch.dependsOn || []).map(id => ({ id })) };
  if (patch.due !== undefined || patch.time !== undefined) {
    const due = patch.due !== undefined ? patch.due : (current && current.due) || null;
    const time = patch.time !== undefined ? patch.time : (current && current.time) || null;
    props['Due date'] = !due ? { date: null } : { date: { start: time ? `${due}T${time}:00${patch.tz || ''}` : due } };
  }
  return props;
}

export function createProperties(op, from) {
  const props = {
    'Subject': { title: [{ type: 'text', text: { content: op.action || 'New task' } }] },
    'Next action': rich(op.action || ''),
    'From': rich(op.from || from || ''),
    'Owner': rich(op.ownerName || ownerName(op.owner)),
    'Category': sel('Action required'),
    'Action required': { checkbox: true },
    'Completed': { checkbox: false },
    'Priority': sel(op.priority || 'No priority'),
  };
  if (op.due) props['Due date'] = { date: { start: op.time ? `${op.due}T${op.time}:00${op.tz || ''}` : op.due } };
  if (op.project) props['Project'] = sel(op.project);
  if (op.category) props['Category'] = sel(op.category);
  if (op.parentId) props['Parent task'] = { relation: [{ id: op.parentId }] };
  return props;
}

export function fail(res, e) {
  const status = e && e.status ? e.status : 500;
  res.status(status).json({ error: e && e.message ? e.message : 'Server error' });
}

// ---- comments (the per-task chat) ----------------------------------------------------
const AUTHOR_RE = /^\[([^\]]{1,40})\]\s*/;
/** Comments are written by the integration, so the author's name travels as a "[Name] " prefix. */
export function commentToMessage(c) {
  const raw = plain(c.rich_text);
  const m = raw.match(AUTHOR_RE);
  const att = (c.attachments || []).map(a => ({ name: a.name || 'file', url: a.file?.url, expires: a.file?.expiry_time || null })).find(a => a.url) || null;
  const isAudio = att && (/\.(m4a|mp3|mp4|aac|wav|ogg|oga|webm|caf|amr|3gp)$/i.test(att.name) || /^audio\//.test(String((c.attachments || [])[0]?.category || (c.attachments || [])[0]?.mime_type || '')));
  return { id: c.id, author: m ? m[1] : 'Notion', text: m ? raw.slice(m[0].length) : raw, at: c.created_time, audio: isAudio ? att : null, file: att && !isAudio ? att : null };
}

export async function listComments(pageId) {
  const out = []; let cursor;
  for (let i = 0; i < 5; i++) {
    const j = await notion(`comments?block_id=${pageId}&page_size=100${cursor ? `&start_cursor=${cursor}` : ''}`, undefined, 'GET');
    (j.results || []).forEach(c => out.push(commentToMessage(c)));
    if (!j.has_more || !j.next_cursor) break;
    cursor = j.next_cursor;
  }
  return out.sort((a, b) => a.at.localeCompare(b.at));
}

export async function addComment(pageId, author, text, fileUploadId) {
  const body = { parent: { page_id: pageId }, rich_text: [{ type: 'text', text: { content: `[${author}] ${text || ''}`.slice(0, 1900) } }] };
  if (fileUploadId) body.attachments = [{ file_upload_id: fileUploadId }];
  const c = await notion('comments', body);
  return commentToMessage(c);
}

// ---- file uploads (deliverables, voice notes) ----------------------------------------
/** Two-step Notion upload: create the upload object, then send the bytes. Returns the upload id to reference in properties/comments. */
export async function uploadFile(filename, contentType, bytes) {
  const token = process.env.NOTION_TOKEN;
  const fu = await notion('file_uploads', { mode: 'single_part', filename, content_type: contentType });
  const form = new FormData();
  form.append('file', new Blob([bytes], { type: contentType }), filename);
  const r = await fetch(`${NOTION_API}/v1/file_uploads/${fu.id}/send`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Notion-Version': NOTION_VERSION }, body: form });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(j.message || `Upload failed (${r.status})`); e.status = 502; throw e; }
  return fu.id;
}

/** Append an uploaded file to a files property without dropping what is already there. */
export async function appendFile(pageId, property, fileUploadId, existing) {
  // Notion keeps files that are passed back exactly as it returned them (external links and Notion-hosted files alike).
  const keep = (existing || []).map(f => {
    if (f.type === 'external' && f.external?.url) return { type: 'external', name: f.name, external: { url: f.external.url } };
    if (f.type === 'file' && f.file?.url) return { type: 'file', name: f.name, file: { url: f.file.url, expiry_time: f.file.expiry_time } };
    if (f.type === 'file_upload' && f.file_upload?.id) return { type: 'file_upload', file_upload: { id: f.file_upload.id } };
    return null;
  }).filter(Boolean);
  await notion(`pages/${pageId}`, { properties: { [property]: { files: [...keep, { type: 'file_upload', file_upload: { id: fileUploadId } }] } } }, 'PATCH');
}
