import { API_BASE } from '../store/useSettings';
import { TEAM_PASSWORD, readSession } from './auth';
import type { Comment, Meta } from './types';

export const hasApi = !!API_BASE;
/** Netlify synchronous functions refuse bodies over 6 MB; keep a margin for the multipart envelope. */
export const MAX_UPLOAD_BYTES = 5.5 * 1024 * 1024;

export function apiHeaders(json = false): Record<string, string> {
  const h: Record<string, string> = {};
  if (json) h['content-type'] = 'application/json';
  const s = readSession();
  h['x-relay-key'] = (s && s.key) || TEAM_PASSWORD;
  if (s) h['x-user'] = s.email;
  return h;
}

async function parse<T>(r: Response): Promise<T> {
  const j = await r.json().catch(() => ({})) as T & { error?: string };
  if (!r.ok) throw new Error(j.error || (r.status === 413 ? 'File too large for the server (max about 5 MB).' : `Server responded ${r.status}`));
  return j;
}

/** Ask the server whether this address + password are accepted. `null` = could not reach the server (offline). */
export async function verifyCredentials(email: string, password: string): Promise<{ ok: boolean; error?: string } | null> {
  if (!hasApi) return null;
  try {
    const r = await fetch(`${API_BASE}/smart-inbox/meta`, { headers: { 'x-relay-key': password, 'x-user': email }, cache: 'no-store' });
    if (r.ok) return { ok: true };
    if (r.status === 401 || r.status === 403) { const j = await r.json().catch(() => ({})) as { error?: string }; return { ok: false, error: j.error || 'Not accepted.' }; }
    return null; // 5xx: the server is there but unwell — fall back to the local check
  } catch { return null; }
}

export async function fetchMeta(): Promise<Meta> {
  const r = await fetch(`${API_BASE}/smart-inbox/meta`, { headers: apiHeaders(), cache: 'no-store' });
  const j = await parse<Meta>(r);
  return { projects: j.projects || [], categories: j.categories || [] };
}

export async function fetchComments(id: string): Promise<Comment[]> {
  const r = await fetch(`${API_BASE}/smart-inbox/comments?id=${encodeURIComponent(id)}`, { headers: apiHeaders(), cache: 'no-store' });
  return (await parse<{ comments: Comment[] }>(r)).comments;
}

export async function postComment(id: string, author: string, text: string): Promise<Comment> {
  const r = await fetch(`${API_BASE}/smart-inbox/comments`, { method: 'POST', headers: apiHeaders(true), body: JSON.stringify({ id, author, text }) });
  return (await parse<{ comment: Comment }>(r)).comment;
}

/** Upload a deliverable or a voice note; the server stores it in Notion and (for voice/with text) posts it to the chat. */
export async function uploadFile(id: string, kind: 'deliverable' | 'voice', file: Blob, filename: string, author: string, text?: string): Promise<Comment | null> {
  if (file.size > MAX_UPLOAD_BYTES) throw new Error(`${filename} is ${(file.size / 1048576).toFixed(1)} MB — the limit is about 5 MB. Send a smaller version or a link.`);
  const fd = new FormData();
  fd.append('id', id); fd.append('kind', kind); fd.append('author', author);
  if (text) fd.append('text', text);
  fd.append('file', file, filename);
  const r = await fetch(`${API_BASE}/smart-inbox/upload`, { method: 'POST', headers: apiHeaders(), body: fd });
  return (await parse<{ comment: Comment | null }>(r)).comment;
}
