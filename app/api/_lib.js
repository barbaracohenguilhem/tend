// Shared helpers for the tend serverless API (Vercel Node functions).
// Talks to the Notion REST API with a server-side integration token; the phone never sees it.

export const DATABASE_ID = '3ce2004f28808045a662d5b0314775dc';
const NOTION_API = process.env.NOTION_API_BASE || 'https://api.notion.com';
const NOTION_VERSION = '2022-06-28';

const PEOPLE = [
  { id: 'carla', name: 'Carla Guilhem', keys: ['carla'] },
  { id: 'fernanda', name: 'Fernanda Britto', keys: ['fernanda'] },
  { id: 'luiz', name: 'Luiz Eduardo Greco', keys: ['luiz', 'eduardo'] },
  { id: 'alessandra', name: 'Alessandra Lopes', keys: ['alessandra'] },
  { id: 'nicola', name: 'Nicola', keys: ['nicola'] },
];
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
  if (!token) { const e = new Error('NOTION_TOKEN is not set on the server. Add it in Vercel → Project → Settings → Environment Variables.'); e.status = 503; throw e; }
  const r = await fetch(`${NOTION_API}/v1/${path}`, {
    method, headers: { Authorization: `Bearer ${token}`, 'Notion-Version': NOTION_VERSION, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(j.message || `Notion responded ${r.status}`); e.status = r.status === 401 ? 503 : 502; throw e; }
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
const files = p => (p && p.type === 'files' && Array.isArray(p.files) ? p.files.map(f => ({ name: f.name, url: f.type === 'external' ? f.external?.url : f.file?.url, expires: f.file?.expiry_time || null })).filter(f => f.url) : []);

function ownerId(s) { const t = (s || '').toLowerCase(); for (const p of PEOPLE) if (p.keys.some(k => t.includes(k))) return p.id; return 'none'; }
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
    from: text(P['From']) || email(P['Sender email']),
    owner: ownerId(text(P['Owner'])),
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
    due: start ? start.slice(0, 10) : null,
    time: start && start.length > 10 ? start.slice(11, 16) : null,
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
  if (patch.completed !== undefined) props['Completed'] = { checkbox: !!patch.completed };
  if (patch.review !== undefined) props['Carla review'] = sel(patch.review);
  if (patch.feedback !== undefined) props['Carla feedback'] = rich(patch.feedback);
  if (patch.draft !== undefined) props['Response / action for approval'] = rich(patch.draft);
  if (patch.priority !== undefined) props['Priority'] = sel(patch.priority || 'No priority');
  if (patch.owner !== undefined) props['Owner'] = rich(ownerName(patch.owner));
  if (patch.resolvedBy !== undefined) props['Resolved by'] = sel(patch.resolvedBy);
  if (patch.project !== undefined) props['Project'] = sel(patch.project);
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
    'From': rich(from || ''),
    'Owner': rich(ownerName(op.owner)),
    'Category': sel('Action required'),
    'Action required': { checkbox: true },
    'Completed': { checkbox: false },
    'Priority': sel(op.priority || 'No priority'),
  };
  if (op.due) props['Due date'] = { date: { start: op.due } };
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
  const audio = (c.attachments || []).map(a => ({ name: a.name || 'voice note', url: a.file?.url, expires: a.file?.expiry_time || null })).find(a => a.url) || null;
  return { id: c.id, author: m ? m[1] : 'Notion', text: m ? raw.slice(m[0].length) : raw, at: c.created_time, audio };
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
  const keep = (existing || []).map(f => f.type === 'external' ? { type: 'external', name: f.name, external: { url: f.external.url } } : { type: 'file_upload', file_upload: { id: f.file_upload?.id } }).filter(f => f.type === 'external' || f.file_upload.id);
  await notion(`pages/${pageId}`, { properties: { [property]: { files: [...keep, { type: 'file_upload', file_upload: { id: fileUploadId } }] } } }, 'PATCH');
}
