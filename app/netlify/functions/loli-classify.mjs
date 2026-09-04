// Classify one e-mail on demand (key-protected). POST JSON { subject, fromName, fromEmail, text, mailbox?, date?, write? }.
// Dry run by default: returns the record and its cost without touching Notion. `write: true` also creates the row.
import { classify } from '../../api/loli/brain.mjs';
import { createRow, findThread } from '../../api/loli/notion.mjs';

export default async function (request) {
  const key = request.headers.get('x-loli-key') || new URL(request.url).searchParams.get('key') || '';
  if (key !== (process.env.LOLI_RUN_KEY || process.env.TEAM_PASSWORD || 'APPCONTROLE').trim()) return new Response('forbidden', { status: 403 });
  if (request.method !== 'POST') return new Response('POST a JSON e-mail', { status: 405 });
  let b; try { b = await request.json(); } catch { return new Response('bad json', { status: 400 }); }
  const email = {
    mailbox: b.mailbox || 'bc@carlaguilhem.com', uid: 0, messageId: b.messageId || `<manual-${Date.now()}@tend>`, threadId: b.threadId || null, gmailLink: b.gmailLink || null,
    subject: String(b.subject || '(sem assunto)'), fromName: String(b.fromName || ''), fromEmail: String(b.fromEmail || ''), to: b.to || [], cc: b.cc || [],
    date: b.date || new Date().toISOString(), labels: [], text: String(b.text || ''), truncated: false, attachments: [],
  };
  const started = Date.now();
  try {
    const thread = email.threadId ? await findThread(email.threadId) : [];
    const { record, usage, model } = await classify(email, thread);
    const usd = ((usage.input_tokens || 0) * 5 + (usage.cache_creation_input_tokens || 0) * 6.25 + (usage.cache_read_input_tokens || 0) * 0.5 + (usage.output_tokens || 0) * 25) / 1e6;
    let rowId = null;
    if (b.write === true) rowId = await createRow(record, email);
    return new Response(JSON.stringify({ record, usage, model, usd: Math.round(usd * 10000) / 10000, ms: Date.now() - started, rowId }, null, 1), { status: 200, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e && e.message ? e.message : String(e), ms: Date.now() - started }), { status: 502, headers: { 'content-type': 'application/json' } });
  }
}
