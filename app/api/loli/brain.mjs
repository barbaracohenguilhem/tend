// The "brain": one e-mail in, one Smart Inbox record out. Claude Opus 5 with structured output, the rubric cached.
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import { fetchFresh } from './http.mjs';
import { CATEGORIES, PRIORITIES, PROJECTS, SYSTEM } from './prompt.mjs';

const MODEL = process.env.LOLI_MODEL || 'claude-opus-5';
const EFFORT = process.env.LOLI_EFFORT || 'high';
const MAX_ATTACHMENTS = 3;
const MAX_ATTACHMENT_BYTES = 12 * 1024 * 1024;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

export const Record = z.object({
  category: z.string().describe(`One of: ${CATEGORIES.join(' | ')}`),
  project: z.string().nullable().describe('Project name from the list, a new short project name, or "Sem projeto"'),
  action_required: z.boolean(),
  title: z.string().describe('Short card title, max 6 words / 48 chars'),
  next_action: z.string().describe('One imperative sentence, or "Nenhuma ação necessária"'),
  owner: z.string().describe('Roster name, an external person, or "Not identified"'),
  priority: z.string().describe(`One of: ${PRIORITIES.join(' | ')}`),
  due_date: z.string().nullable().describe('YYYY-MM-DD or null'),
  due_time: z.string().nullable().describe('HH:MM in the e-mail\'s local time, or null'),
  summary: z.string().describe('Two sentences at most, Portuguese'),
  response: z.string().nullable().describe('Draft message or checklist for approval; null when no action'),
  deliverable_requested: z.string().nullable(),
  meeting_followup: z.boolean(),
  meeting_summary: z.string().nullable(),
  rationale: z.string().describe('One short sentence: why this category / action decision'),
});

let client = null;
function anthropic() { if (!client) client = new Anthropic({ maxRetries: 3, timeout: 10 * 60 * 1000, fetch: fetchFresh }); return client; }

/** Seconds to wait before each slow retry of a call that could not connect at all (the API edge has been seen to
 *  refuse TLS handshakes for about a minute at a time; the SDK's own retries give up within 4 s). */
export const RECONNECT_WAITS = [8, 15, 25, 40];
const sleep = s => new Promise(r => setTimeout(r, s * 1000));

/** An edge rejection: could not connect at all, or the edge answered 403 with no body (a real permission
 *  error from the API carries a JSON body and a message). Neither is a verdict on the request itself. */
export function isEdgeRejection(e) {
  if (e instanceof Anthropic.APIConnectionTimeoutError) return false;
  if (e instanceof Anthropic.APIConnectionError) return true;
  return e instanceof Anthropic.APIError && e.status === 403 && /no body/i.test(e.message || '');
}

/** Run one SDK call; on an edge rejection wait and try again, up to RECONNECT_WAITS. */
export async function withReconnect(call, { waits = RECONNECT_WAITS, log = () => {} } = {}) {
  for (let attempt = 0; ; attempt++) {
    try { return await call(); } catch (e) {
      if (!isEdgeRejection(e) || attempt >= waits.length) throw e;
      log(`loli: connection failed (${describeError(e)}); retrying in ${waits[attempt]} s`);
      await sleep(waits[attempt]);
    }
  }
}

/** Marker of the Node process (a warm serverless container keeps it between invocations). */
export const PROCESS = { id: Math.random().toString(36).slice(2, 8), calls: 0 };

/** One line describing a failure, including the network cause the Anthropic SDK wraps (ECONNRESET, ENOTFOUND, ...). */
export function describeError(e) {
  if (!e) return String(e);
  const parts = [(e.constructor && e.constructor.name !== 'Error' ? e.constructor.name : null) || (e.name !== 'Error' ? e.name : null), e.status ? `HTTP ${e.status}` : null, e.message || String(e)];
  let c = e.cause; let depth = 0;
  while (c && depth++ < 4) { parts.push(`cause: ${c.name || ''} ${c.code || ''} ${c.errno || ''} ${c.syscall || ''} ${c.message || ''}`.replace(/\s+/g, ' ').trim()); c = c.cause; }
  return parts.filter(Boolean).join(' | ');
}

/** Attachments Claude can read directly: PDFs as documents, images as images. Everything else is listed by name. */
function attachmentBlocks(attachments) {
  const blocks = []; const listed = []; let bytes = 0;
  for (const a of attachments || []) {
    const isPdf = a.contentType === 'application/pdf' || /\.pdf$/i.test(a.filename);
    const isImage = IMAGE_TYPES.includes(a.contentType);
    listed.push(`${a.filename} (${a.contentType}, ${Math.round((a.size || 0) / 1024)} KB)`);
    if (!a.content || (!isPdf && !isImage) || blocks.length >= MAX_ATTACHMENTS || bytes + a.content.length > MAX_ATTACHMENT_BYTES) continue;
    bytes += a.content.length;
    const data = Buffer.from(a.content).toString('base64');
    blocks.push(isPdf
      ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data }, title: a.filename }
      : { type: 'image', source: { type: 'base64', media_type: a.contentType, data } });
  }
  return { blocks, listed };
}

export function emailText(email, thread) {
  const head = [
    `Mailbox: ${email.mailbox}`, `From: ${email.fromName} <${email.fromEmail}>`, `To: ${email.to.join(', ')}`,
    email.cc.length ? `Cc: ${email.cc.join(', ')}` : null, `Date: ${email.date}`, `Subject: ${email.subject}`,
    email.labels && email.labels.length ? `Gmail labels: ${email.labels.join(', ')}` : null,
  ].filter(Boolean).join('\n');
  const ctx = thread && thread.length
    ? `\n\n## Existing Smart Inbox records for this thread (oldest first)\n${thread.map(t => `- [${t.received || ''}] ${t.subject} — Category ${t.category || '?'}, Project ${t.project || '?'}, Owner ${t.owner || '?'}, Action required ${t.actionRequired ? 'yes' : 'no'}, Carla review ${t.review || '—'}, Completed ${t.completed ? 'yes' : 'no'}\n  Summary: ${t.summary || ''}\n  Next action: ${t.nextAction || ''}`).join('\n')}`
    : '';
  return `## E-mail\n${head}\n\n${email.text || '(sem texto)'}${email.truncated ? '\n\n[texto truncado]' : ''}${ctx}`;
}

/** Classify one e-mail. Returns { record, usage, model }. */
export async function classify(email, thread = []) {
  PROCESS.calls++;
  const { blocks, listed } = attachmentBlocks(email.attachments);
  const content = [
    ...blocks,
    { type: 'text', text: `${emailText(email, thread)}\n\n## Attachments\n${listed.length ? listed.join('\n') : 'none'}${blocks.length ? '\n(the PDF/image attachments above are attached for you to read)' : ''}\n\nProduce the Smart Inbox record for this e-mail.` },
  ];
  const r = await withReconnect(() => anthropic().messages.parse({
    model: MODEL, max_tokens: 8000,
    output_config: { effort: EFFORT, format: zodOutputFormat(Record) },
    system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content }],
  }), { log: console.log });
  if (r.stop_reason === 'refusal') throw new Error('Claude declined this e-mail (refusal)');
  const record = r.parsed_output;
  if (!record) throw new Error('Claude returned no structured record');
  return { record: normalize(record), usage: r.usage, model: r.model };
}

/** Rewrite a proposal after Carla asked for changes. Returns { record, usage }. */
export async function revise({ emailBody, subject, previousDraft, previousNextAction, feedback, thread = [] }) {
  const r = await withReconnect(() => anthropic().messages.parse({
    model: MODEL, max_tokens: 8000,
    output_config: { effort: EFFORT, format: zodOutputFormat(Record) },
    system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: `## E-mail (as registered)\nSubject: ${subject}\n\n${emailBody || '(texto não disponível)'}\n\n## Previous proposal\nNext action: ${previousNextAction || ''}\n\n${previousDraft || ''}\n\n## Carla's feedback ("Changes requested")\n${feedback}\n\nRevise the record so the proposal answers Carla's feedback exactly. Keep everything she did not object to. Produce the full Smart Inbox record again.` }],
  }), { log: console.log });
  if (r.stop_reason === 'refusal') throw new Error('Claude declined this revision (refusal)');
  if (!r.parsed_output) throw new Error('Claude returned no structured record');
  return { record: normalize(r.parsed_output), usage: r.usage, model: r.model };
}

function normalize(x) {
  const out = { ...x };
  if (!CATEGORIES.includes(out.category)) out.category = out.action_required ? 'Action required' : 'Newsletter / Information';
  if (!PRIORITIES.includes(out.priority)) out.priority = out.action_required ? 'Medium' : 'No priority';
  if (!out.action_required) { out.priority = 'No priority'; out.response = null; if (!out.next_action || /^nenhuma|^no action/i.test(out.next_action) === false && out.next_action.length < 4) out.next_action = 'Nenhuma ação necessária'; }
  if (!out.project || !out.project.trim()) out.project = 'Sem projeto';
  const known = PROJECTS.find(([n]) => n.toLowerCase() === String(out.project).toLowerCase()); if (known) out.project = known[0];
  out.title = String(out.title || '').replace(/[.]+$/, '').trim().slice(0, 64);
  out.owner = String(out.owner || 'Not identified').trim() || 'Not identified';
  if (/^carla guilhem$/i.test(out.owner)) out.owner = 'Carla';
  if (out.due_date && !/^\d{4}-\d{2}-\d{2}$/.test(out.due_date)) out.due_date = null;
  if (out.due_time && !/^\d{2}:\d{2}$/.test(out.due_time)) out.due_time = null;
  return out;
}
