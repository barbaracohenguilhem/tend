// Classify one e-mail on demand (key-protected, background: the model can take a minute). POST JSON
// { id?, subject, fromName, fromEmail, text, mailbox?, date?, threadId?, write? }. Returns 202 at once; the result lands in
// the run state and is shown by loli-status under `classified` (newest first). `write: true` also creates the row.
import { classify } from '../../api/loli/brain.mjs';
import { createRow, findThread } from '../../api/loli/notion.mjs';
import { blobState } from '../../api/loli/state.mjs';

export default async function (request) {
  const key = request.headers.get('x-loli-key') || new URL(request.url).searchParams.get('key') || '';
  if (key !== (process.env.LOLI_RUN_KEY || process.env.TEAM_PASSWORD || 'APPCONTROLE').trim()) return new Response('forbidden', { status: 403 });
  if (request.method !== 'POST') return new Response('POST a JSON e-mail', { status: 405 });
  let b; try { b = await request.json(); } catch { return new Response('bad json', { status: 400 }); }
  const id = String(b.id || `manual-${Date.now()}`);
  const email = {
    mailbox: b.mailbox || 'bc@carlaguilhem.com', uid: 0, messageId: b.messageId || `<${id}@tend>`, threadId: b.threadId || null, gmailLink: b.gmailLink || null,
    subject: String(b.subject || '(sem assunto)'), fromName: String(b.fromName || ''), fromEmail: String(b.fromEmail || ''), to: b.to || [], cc: b.cc || [],
    date: b.date || new Date().toISOString(), labels: [], text: String(b.text || ''), truncated: false, attachments: [],
  };
  const state = blobState();
  const started = Date.now();
  const entry = { id, subject: email.subject, startedAt: new Date(started).toISOString() };
  try {
    const thread = email.threadId ? await findThread(email.threadId) : [];
    const { record, usage, model } = await classify(email, thread);
    entry.usd = Math.round((((usage.input_tokens || 0) * 5 + (usage.cache_creation_input_tokens || 0) * 6.25 + (usage.cache_read_input_tokens || 0) * 0.5 + (usage.output_tokens || 0) * 25) / 1e6) * 10000) / 10000;
    entry.usage = usage; entry.model = model; entry.record = record;
    if (b.write === true) entry.rowId = await createRow(record, email);
  } catch (e) { entry.error = e && e.message ? e.message : String(e); }
  entry.ms = Date.now() - started;
  await state.set(`classified:${String(started).padStart(15, '0')}-${id.replace(/[^A-Za-z0-9_-]/g, '_')}`, entry);
  console.log('loli classify', JSON.stringify({ id, ms: entry.ms, error: entry.error, title: entry.record && entry.record.title }));
  return new Response(JSON.stringify(entry), { status: 200, headers: { 'content-type': 'application/json' } });
}
