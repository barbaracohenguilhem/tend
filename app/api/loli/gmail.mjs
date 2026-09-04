// Reads a Gmail mailbox over IMAP with an app password. Never marks mail as read (BODY.PEEK) and never sends anything.
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';

const MAX_TEXT = 40_000;

/** Messages in INBOX newer than the cursor (UID) or, on the first run, since a date. Returns parsed emails in UID order. */
export async function fetchNewEmails({ user, password, host = 'imap.gmail.com', port = 993 }, { lastUid = 0, since, limit = 8 } = {}) {
  const client = new ImapFlow({ host, port, secure: true, auth: { user, pass: password }, logger: false, emitLogs: false });
  await client.connect();
  const emails = [];
  try {
    const lock = await client.getMailboxLock('INBOX');
    try {
      const query = lastUid ? { uid: `${lastUid + 1}:*` } : { since: since || new Date() };
      let uids = (await client.search(query, { uid: true })) || [];
      // "n:*" always includes the newest message even when its UID is below n — drop anything already seen.
      uids = uids.filter(u => u > lastUid).sort((a, b) => a - b);
      const batch = uids.slice(0, limit);
      for (const uid of batch) {
        const msg = await client.fetchOne(String(uid), { uid: true, source: true, envelope: true, threadId: true, labels: true, internalDate: true, size: true }, { uid: true });
        if (!msg || !msg.source) continue;
        const parsed = await simpleParser(msg.source);
        emails.push(toEmail(user, msg, parsed));
      }
      return { emails, newestUid: uids.length ? uids[uids.length - 1] : lastUid, remaining: Math.max(0, uids.length - batch.length) };
    } finally { lock.release(); }
  } finally { await client.logout().catch(() => {}); }
}

/** Plain text out of an HTML-only e-mail: drop scripts and styles, keep line breaks, decode the common entities. */
export function htmlToText(html) {
  return String(html || '')
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|tr|li|h[1-6]|blockquote)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').replace(/[ \t]{2,}/g, ' ').trim();
}

export function toEmail(mailbox, msg, parsed) {
  const from = (parsed.from && parsed.from.value && parsed.from.value[0]) || {};
  const text = (parsed.text && parsed.text.trim()) ? parsed.text.replace(/\r\n/g, '\n').trim() : htmlToText(parsed.html || parsed.textAsHtml || '');
  const attachments = (parsed.attachments || []).filter(a => !a.related || a.contentDisposition === 'attachment').map(a => ({
    filename: a.filename || 'anexo', contentType: (a.contentType || 'application/octet-stream').toLowerCase(), size: a.size || (a.content ? a.content.length : 0), content: a.content,
  }));
  const threadId = msg.threadId ? String(msg.threadId) : null;
  let threadHex = null;
  try { threadHex = threadId ? BigInt(threadId).toString(16) : null; } catch { threadHex = null; }
  const addresses = list => (list && list.value ? list.value : []).map(v => v.address).filter(Boolean);
  return {
    mailbox, uid: msg.uid, size: msg.size || 0,
    messageId: (parsed.messageId || '').trim() || `<uid-${msg.uid}@${mailbox}>`,
    threadId,
    gmailLink: threadHex ? `https://mail.google.com/mail/?authuser=${encodeURIComponent(mailbox)}#all/${threadHex}` : null,
    subject: (parsed.subject || '').trim() || '(sem assunto)',
    fromName: (from.name || from.address || '').trim(), fromEmail: (from.address || '').trim().toLowerCase(),
    to: addresses(parsed.to), cc: addresses(parsed.cc),
    date: (parsed.date || msg.internalDate || new Date()).toISOString(),
    labels: msg.labels ? [...msg.labels] : [],
    text: text.slice(0, MAX_TEXT), truncated: text.length > MAX_TEXT,
    attachments,
  };
}
