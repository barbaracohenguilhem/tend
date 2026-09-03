import { API_BASE } from '../store/useSettings';
import { TEAM_PASSWORD, readSession } from './auth';
import type { Comment } from './types';

export const hasApi = !!API_BASE;

export function apiHeaders(json = false): Record<string, string> {
  const h: Record<string, string> = {};
  if (json) h['content-type'] = 'application/json';
  h['x-relay-key'] = TEAM_PASSWORD;
  const s = readSession();
  if (s) h['x-user'] = s.email;
  return h;
}

async function parse<T>(r: Response): Promise<T> {
  const j = await r.json().catch(() => ({})) as T & { error?: string };
  if (!r.ok) throw new Error(j.error || `Server responded ${r.status}`);
  return j;
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
  const fd = new FormData();
  fd.append('id', id); fd.append('kind', kind); fd.append('author', author);
  if (text) fd.append('text', text);
  fd.append('file', file, filename);
  const r = await fetch(`${API_BASE}/smart-inbox/upload`, { method: 'POST', headers: apiHeaders(), body: fd });
  return (await parse<{ comment: Comment | null }>(r)).comment;
}
