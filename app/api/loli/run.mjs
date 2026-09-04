// One pass of the robot: new e-mails from every mailbox → Smart Inbox rows; then Carla's "Changes requested" → revised proposals.
import { fetchNewEmails } from './gmail.mjs';
import { classify, describeError, revise } from './brain.mjs';
import { createMeetingSummary, createRow, findByMessageId, findThread, listChangesRequested, readPageText, updateRow } from './notion.mjs';

const LOCK_MS = 12 * 60 * 1000;
const MAX_FAILURES = 3;

/** Mailboxes from the environment: LOLI_GMAIL_1_USER / LOLI_GMAIL_1_PASS … or LOLI_MAILBOXES as JSON. */
export function mailboxesFromEnv(env = process.env) {
  const out = [];
  if (env.LOLI_MAILBOXES) { try { out.push(...JSON.parse(env.LOLI_MAILBOXES)); } catch { /* fall through to the numbered form */ } }
  for (let i = 1; i <= 6; i++) {
    const user = (env[`LOLI_GMAIL_${i}_USER`] || '').trim(), password = (env[`LOLI_GMAIL_${i}_PASS`] || '').replace(/\s+/g, '');
    if (user && password) out.push({ user, password });
  }
  return out;
}

const cost = u => (!u ? 0 : ((u.input_tokens || 0) * 5 + (u.cache_creation_input_tokens || 0) * 6.25 + (u.cache_read_input_tokens || 0) * 0.5 + (u.output_tokens || 0) * 25) / 1e6);

export async function runOnce({ state, mailboxes = mailboxesFromEnv(), fetch = fetchNewEmails, brain = { classify, revise }, db = { createRow, updateRow, findByMessageId, findThread, listChangesRequested, readPageText, createMeetingSummary }, limit = 8, since, force = false, log = console.log } = {}) {
  const startedAt = new Date().toISOString();
  const report = { startedAt, mailboxes: [], revisions: [], errors: [], usd: 0 };
  const lock = await state.get('lock');
  if (!force && lock && Date.now() - lock.at < LOCK_MS) { report.skipped = 'another run is in progress'; return report; }
  await state.set('lock', { at: Date.now() });
  try {
    if (!mailboxes.length) report.errors.push('no mailbox configured (LOLI_GMAIL_1_USER / LOLI_GMAIL_1_PASS)');
    for (const mb of mailboxes) {
      const mbReport = { user: mb.user, fetched: 0, created: 0, updated: 0, skipped: 0, failed: 0 };
      report.mailboxes.push(mbReport);
      try {
        const cursor = (await state.get(`cursor:${mb.user}`)) || null;
        const firstRun = !cursor;
        const sinceDate = since || (process.env.LOLI_SINCE ? new Date(process.env.LOLI_SINCE) : startOfToday());
        const { emails, newestUid, remaining } = await fetch(mb, { lastUid: cursor ? cursor.uid : 0, since: sinceDate, limit });
        mbReport.fetched = emails.length; mbReport.remaining = remaining;
        if (firstRun && !emails.length) await state.set(`cursor:${mb.user}`, { uid: newestUid || 0, at: Date.now() });
        for (const email of emails) {
          const failKey = `fail:${mb.user}:${email.uid}`;
          try {
            const outcome = await processEmail(email, { brain, db, log, report });
            mbReport[outcome]++;
            await state.set(`cursor:${mb.user}`, { uid: email.uid, at: Date.now() });
          } catch (e) {
            const failures = ((await state.get(failKey)) || 0) + 1;
            await state.set(failKey, failures);
            mbReport.failed++;
            report.errors.push(`${mb.user} uid ${email.uid} (${email.subject.slice(0, 60)}): ${describeError(e)}`);
            log('loli: e-mail failed', mb.user, email.uid, describeError(e));
            if (failures >= MAX_FAILURES) { await state.set(`cursor:${mb.user}`, { uid: email.uid, at: Date.now() }); report.errors.push(`${mb.user} uid ${email.uid}: skipped after ${failures} failures`); continue; }
            break; // retry this one on the next run, keep order
          }
        }
      } catch (e) { mbReport.error = describeError(e); report.errors.push(`${mb.user}: ${mbReport.error}`); log('loli: mailbox failed', mb.user, mbReport.error); }
    }
    // Revisions: Carla asked for changes on a row the robot wrote.
    try {
      const rows = await db.listChangesRequested();
      for (const row of rows.slice(0, 5)) {
        try {
          const emailBody = await db.readPageText(row.id);
          const thread = row.threadId ? await db.findThread(row.threadId) : [];
          const { record, usage } = await brain.revise({ emailBody, subject: row.subject, previousDraft: row.draft, previousNextAction: row.nextAction, feedback: row.feedback, thread });
          report.usd += cost(usage);
          await db.updateRow(row.id, { ...record, action_required: true }, null);
          report.revisions.push({ id: row.id, subject: row.subject });
        } catch (e) { report.errors.push(`revision ${row.id}: ${describeError(e)}`); }
      }
    } catch (e) { report.errors.push(`revisions: ${describeError(e)}`); }
  } finally {
    await state.set('lock', null);
    report.finishedAt = new Date().toISOString();
    report.usd = Math.round(report.usd * 10000) / 10000;
    const runs = (await state.get('runs')) || [];
    runs.unshift(report); await state.set('runs', runs.slice(0, 60));
  }
  return report;
}

async function processEmail(email, { brain, db, log, report }) {
  if (await db.findByMessageId(email.messageId)) return 'skipped';
  const thread = await db.findThread(email.threadId);
  const { record, usage } = await brain.classify(email, thread);
  report.usd += cost(usage);
  // A reply on a thread whose record is still open and not yet approved refreshes that record instead of adding a duplicate.
  const open = [...thread].reverse().find(t => !t.completed && t.review !== 'Approved' && t.review !== 'Barbara to handle');
  let rowId, outcome;
  if (open) { await db.updateRow(open.id, record, email); rowId = open.id; outcome = 'updated'; }
  else { rowId = await db.createRow(record, email); outcome = 'created'; }
  if (record.meeting_followup && record.meeting_summary) {
    await db.createMeetingSummary(email.subject, record.meeting_summary, rowId).catch(e => { report.errors.push(`meeting summary for ${email.subject.slice(0, 40)}: ${e.message}`); });
  }
  log('loli:', outcome, email.mailbox, email.uid, `[${record.category}]`, record.title, `$${cost(usage).toFixed(4)}`);
  return outcome;
}

function startOfToday() { const d = new Date(); d.setUTCHours(0, 0, 0, 0); return d; }
