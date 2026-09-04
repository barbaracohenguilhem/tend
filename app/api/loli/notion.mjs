// Reads and writes Smart Inbox rows for the robot through the same Notion integration the app uses.
import { notion } from '../_lib.js';

const SHADOW_DS = 'd8a913b6-15ad-4c9c-beff-27e4c5188336';
const DS = () => (process.env.LOLI_DATA_SOURCE_ID || SHADOW_DS).trim();

/** The data source the robot writes to. LOLI_DATA_SOURCE_ID may hold a data source id or a database id (the
 *  Smart Inbox page): a database is resolved to its first data source once per process. */
let resolved = null;
export async function dataSourceId() {
  if (resolved) return resolved;
  const id = DS();
  try { await notion(`data_sources/${id}`, undefined, 'GET'); return (resolved = id); } catch (e) { if (e.status !== 404 && !/data source/i.test(e.message || '')) throw e; }
  try {
    const db = await notion(`databases/${id}`, undefined, 'GET');
    const first = (db.data_sources || [])[0];
    if (first && first.id) return (resolved = first.id);
  } catch { /* not a database either: use the id as given and let the real call report the problem */ }
  return (resolved = id);
}
const MEETING_DS = () => (process.env.LOLI_MEETING_DATA_SOURCE_ID || '362b5289-2bba-4274-ad3c-433b888d67c7').trim();
const CHUNK = 1900;

const chunk = s => { const out = []; const t = String(s ?? ''); for (let i = 0; i < t.length; i += CHUNK) out.push(t.slice(i, i + CHUNK)); return out.length ? out : ['']; };
const rich = s => ({ rich_text: chunk(s).map(content => ({ type: 'text', text: { content } })) });
const title = s => ({ title: chunk(String(s || '').slice(0, 1900)).map(content => ({ type: 'text', text: { content } })) });
const sel = name => ({ select: name ? { name: String(name).slice(0, 100) } : null });
const check = v => ({ checkbox: !!v });
const plain = arr => (Array.isArray(arr) ? arr.map(t => t.plain_text ?? (t.text && t.text.content) ?? '').join('') : '').trim();
const text = p => (!p ? '' : p.type === 'title' ? plain(p.title) : p.type === 'rich_text' ? plain(p.rich_text) : '');
const select = p => (p && p.type === 'select' && p.select ? p.select.name : null);
const checkbox = p => !!(p && p.type === 'checkbox' && p.checkbox);
const dateStart = p => (p && p.type === 'date' && p.date && p.date.start) || null;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function rowSummary(page) {
  const P = page.properties || {};
  return {
    id: String(page.id || '').replace(/-/g, ''), subject: text(P['Subject']), title: text(P['Title']), category: select(P['Category']), project: select(P['Project']),
    owner: text(P['Owner']), actionRequired: checkbox(P['Action required']), review: select(P['Carla review']), completed: checkbox(P['Completed']),
    summary: text(P['Summary']), nextAction: text(P['Next action']), draft: text(P['Response / action for approval']), feedback: text(P['Carla feedback']),
    received: dateStart(P['Received at']), messageId: text(P['Message id']), threadId: text(P['Thread id']), source: select(P['Source']),
  };
}

async function query(filter, sorts, pageSize = 20) {
  const j = await notion(`data_sources/${await dataSourceId()}/query`, { page_size: pageSize, filter, sorts });
  return (j.results || []).map(rowSummary);
}

export const findByMessageId = id => query({ property: 'Message id', rich_text: { equals: id } }, undefined, 1).then(r => r[0] || null);
export const findThread = threadId => (threadId ? query({ property: 'Thread id', rich_text: { equals: threadId } }, [{ timestamp: 'created_time', direction: 'ascending' }], 20) : Promise.resolve([]));
export const listChangesRequested = () => query({ and: [{ property: 'Carla review', select: { equals: 'Changes requested' } }, { property: 'Source', select: { equals: 'tend' } }, { property: 'Completed', checkbox: { equals: false } }] }, undefined, 20);

/** Notion properties for a record. `email` is null on a revision (keeps the e-mail fields untouched). */
export function recordProperties(record, email) {
  const props = {
    'Title': rich(record.title), 'Summary': rich(record.summary), 'Category': sel(record.category), 'Project': sel(record.project || 'Sem projeto'),
    'Action required': check(record.action_required), 'Next action': rich(record.next_action || (record.action_required ? '' : 'Nenhuma ação necessária')),
    'Owner': rich(record.owner || 'Not identified'), 'Priority': sel(record.priority || 'No priority'),
    'Due date': record.due_date ? { date: { start: record.due_time ? `${record.due_date}T${record.due_time}:00` : record.due_date } } : { date: null },
    'Response / action for approval': rich(record.action_required ? record.response || '' : ''),
    'Deliverable requested': rich(record.deliverable_requested || ''),
    'Carla review': sel(record.action_required ? 'Pending review' : null),
    'Source': sel('tend'),
  };
  if (email) Object.assign(props, {
    'Subject': title(email.subject), 'From': rich(email.fromName || email.fromEmail), 'Sender email': { email: EMAIL_RE.test(email.fromEmail) ? email.fromEmail : null },
    'Mailbox': sel(email.mailbox), 'Received at': { date: { start: email.date } }, 'Has attachments': check(email.attachments && email.attachments.length),
    'Gmail link': { url: email.gmailLink || null }, 'Message id': rich(email.messageId), 'Thread id': rich(email.threadId || ''), 'Completed': check(false),
  });
  return props;
}

export async function createRow(record, email) {
  const page = await notion('pages', { parent: { type: 'data_source_id', data_source_id: await dataSourceId() }, properties: recordProperties(record, email), children: bodyBlocks(email) });
  return String(page.id || '').replace(/-/g, '');
}

export async function updateRow(pageId, record, email) {
  await notion(`pages/${pageId}`, { properties: recordProperties(record, email) }, 'PATCH');
  if (email) await notion(`blocks/${pageId}/children`, { children: bodyBlocks(email, true) }, 'PATCH').catch(() => undefined);
}

/** The e-mail text goes into the page so a person (and the revision loop) can read the original in Notion. */
function bodyBlocks(email, continuation = false) {
  if (!email) return [];
  const heading = continuation ? `Novo e-mail no mesmo assunto — ${email.date}` : `E-mail original — ${email.date}`;
  const para = t => ({ object: 'block', type: 'paragraph', paragraph: { rich_text: [{ type: 'text', text: { content: t } }] } });
  const meta = `De: ${email.fromName} <${email.fromEmail}>\nPara: ${email.to.join(', ')}${email.cc.length ? `\nCc: ${email.cc.join(', ')}` : ''}${email.attachments && email.attachments.length ? `\nAnexos: ${email.attachments.map(a => a.filename).join(', ')}` : ''}`;
  const body = String(email.text || '').slice(0, 12000);
  return [
    { object: 'block', type: 'heading_3', heading_3: { rich_text: [{ type: 'text', text: { content: heading } }] } },
    para(meta),
    ...chunk(body).slice(0, 8).map(para),
  ];
}

export async function readPageText(pageId) {
  const out = []; let cursor;
  for (let i = 0; i < 5; i++) {
    const j = await notion(`blocks/${pageId}/children?page_size=100${cursor ? `&start_cursor=${cursor}` : ''}`, undefined, 'GET');
    for (const b of j.results || []) { const t = b[b.type] && b[b.type].rich_text ? plain(b[b.type].rich_text) : ''; if (t) out.push(t); }
    if (!j.has_more || !j.next_cursor) break; cursor = j.next_cursor;
  }
  return out.join('\n');
}

/** Zoom follow-ups: a page in the meeting summaries database, linked from the row when the relation exists. */
export async function createMeetingSummary(subject, summaryText, rowId) {
  const page = await notion('pages', {
    parent: { type: 'data_source_id', data_source_id: MEETING_DS() },
    properties: { 'Name': title(subject) },
    children: chunk(summaryText).slice(0, 10).map(t => ({ object: 'block', type: 'paragraph', paragraph: { rich_text: [{ type: 'text', text: { content: t } }] } })),
  }).catch(async e => {
    // The title property of that database may not be called "Name": look it up once and retry.
    const ds = await notion(`data_sources/${MEETING_DS()}`, undefined, 'GET');
    const titleProp = Object.entries(ds.properties || {}).find(([, p]) => p.type === 'title');
    if (!titleProp) throw e;
    return notion('pages', { parent: { type: 'data_source_id', data_source_id: MEETING_DS() }, properties: { [titleProp[0]]: title(subject) } });
  });
  const meetingId = String(page.id || '').replace(/-/g, '');
  if (rowId) await notion(`pages/${rowId}`, { properties: { 'Meeting summary': { relation: [{ id: meetingId }] } } }, 'PATCH').catch(() => undefined);
  return meetingId;
}
