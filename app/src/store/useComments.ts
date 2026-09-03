import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchComments, hasApi, postComment, uploadFile } from '../lib/api';
import type { Comment } from '../lib/types';

/** The per-task chat, backed by Notion page comments. */
export function useComments(id: string | null, author: string) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const live = useRef(true);
  /** Bumped whenever the task changes, so a slow answer for the previous task is ignored. */
  const req = useRef(0);
  useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);

  const load = useCallback(async () => {
    const mine = ++req.current;
    setComments([]); setError(null);
    if (!id || !hasApi || id.startsWith('local-')) { setLoading(false); return; }
    setLoading(true);
    try { const c = await fetchComments(id); if (live.current && req.current === mine) setComments(c); }
    catch (e) { if (live.current && req.current === mine) setError(e instanceof Error ? e.message : 'Could not load the conversation'); }
    finally { if (live.current && req.current === mine) setLoading(false); }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const send = useCallback(async (text: string) => {
    if (!id || !text.trim()) return;
    setBusy(true);
    const optimistic: Comment = { id: 'tmp-' + Date.now(), author, text: text.trim(), at: new Date().toISOString() };
    setComments(c => [...c, optimistic]);
    try { const saved = await postComment(id, author, text.trim()); if (live.current) setComments(c => c.map(x => (x.id === optimistic.id ? saved : x))); }
    catch (e) { if (live.current) { setComments(c => c.filter(x => x.id !== optimistic.id)); setError(e instanceof Error ? e.message : 'Could not send'); } }
    finally { if (live.current) setBusy(false); }
  }, [id, author]);

  const upload = useCallback(async (kind: 'deliverable' | 'voice', file: Blob, filename: string, text?: string) => {
    if (!id) return false;
    setBusy(true); setError(null);
    try {
      const c = await uploadFile(id, kind, file, filename, author, text);
      if (live.current && c) setComments(cs => [...cs, c]);
      return true;
    } catch (e) { if (live.current) setError(e instanceof Error ? e.message : 'Upload failed'); return false; }
    finally { if (live.current) setBusy(false); }
  }, [id, author]);

  return { comments, loading, error, busy, send, upload, reload: load, available: hasApi && !!id && !id.startsWith('local-') };
}
