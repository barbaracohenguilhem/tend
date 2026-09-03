import { useCallback, useEffect, useRef, useState } from 'react';
import { readValue, writeJson } from '../lib/storage';
import type { Mode, RelayOp, Settings, Snapshot, Task, TaskPatch } from '../lib/types';
import { DEFAULT_DATA_URL } from './useSettings';

const POLL_MS = 60_000;
/** How long a locally applied patch keeps overriding a fresh snapshot (covers relay → Notion → next poll lag). */
const OVERLAY_MS = 120_000;

interface Overlay { patch: TaskPatch; at: number }

function normalize(t: Partial<Task> & Pick<Task, 'id'>): Task {
  return { action: '', subject: '', from: '', owner: 'none', priority: null, category: '', review: null, completed: false,
    feedback: null, gmail: null, draft: null, summary: '', time: null, due: null, ...t };
}

/**
 * Smart Inbox data: loads the snapshot (local file or relay GET), applies queued/optimistic changes on top,
 * and posts write-backs to the relay — queueing them while no relay URL is set or the relay is unreachable.
 */
export function useInbox(settings: Settings, mode: Mode, notify: (text: string) => void) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<RelayOp[]>(() => readValue<RelayOp[]>('pending', []));
  const created = useRef<Record<string, Task>>(readValue('created', {}));
  const overlay = useRef<Record<string, Overlay>>(readValue('overlay', {}));
  const pollTimer = useRef<number | undefined>(undefined);
  const flushing = useRef(false);
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const pendingRef = useRef(pending);
  pendingRef.current = pending;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  useEffect(() => { writeJson('pending', pending); }, [pending]);

  const headers = useCallback((json: boolean) => {
    const h: Record<string, string> = {};
    if (json) h['content-type'] = 'application/json';
    if (settingsRef.current.relayKey) h['x-relay-key'] = settingsRef.current.relayKey;
    return h;
  }, []);

  /** Re-apply everything the server may not know about yet: queued ops, recent optimistic patches, local creates. */
  const applyLocal = useCallback((items: Task[]): Task[] => {
    const now = Date.now();
    const ids = new Set(items.map(t => t.id));
    const queued: Record<string, TaskPatch> = {};
    pendingRef.current.forEach(op => { if (op.kind === 'update') queued[op.id] = { ...(queued[op.id] || {}), ...op.patch }; });
    const out = items.map(t => {
      const o = overlay.current[t.id];
      const withOverlay = o && now - o.at < OVERLAY_MS ? { ...t, ...o.patch } : t;
      return queued[t.id] ? { ...withOverlay, ...queued[t.id] } : withOverlay;
    });
    Object.values(created.current).forEach(t => {
      if (ids.has(t.id)) { delete created.current[t.id]; return; }
      const o = overlay.current[t.id];
      out.push(o ? { ...t, ...o.patch } : t);
    });
    writeJson('created', created.current);
    return out;
  }, []);

  const load = useCallback(async () => {
    const url = settingsRef.current.dataUrl || DEFAULT_DATA_URL;
    const remote = /^https?:/i.test(url);
    try {
      const r = await fetch(url, { cache: 'no-store', headers: remote ? headers(false) : undefined });
      if (!r.ok) throw new Error(String(r.status));
      const j = (await r.json()) as Snapshot;
      setTasks(applyLocal((j.items || []).map(normalize)));
    } catch {
      notify('Could not load the Smart Inbox');
    } finally {
      setLoading(false);
    }
    window.clearTimeout(pollTimer.current);
    if (remote) pollTimer.current = window.setTimeout(load, POLL_MS);
  }, [applyLocal, headers, notify]);

  useEffect(() => {
    setLoading(true);
    load();
    const onVisible = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { document.removeEventListener('visibilitychange', onVisible); window.clearTimeout(pollTimer.current); };
  }, [load, settings.dataUrl, settings.relayKey]);

  const post = useCallback(async (op: RelayOp) => {
    const base = settingsRef.current.relayUrl.replace(/\/$/, '');
    const r = await fetch(`${base}/smart-inbox/${op.kind}`, {
      method: 'POST', headers: headers(true), body: JSON.stringify({ ...op, actor: modeRef.current }),
    });
    if (!r.ok) throw new Error(String(r.status));
  }, [headers]);

  /** Send queued ops in order; stop at the first failure and keep the rest queued. */
  const flush = useCallback(async (loud = false) => {
    if (flushing.current || !settingsRef.current.relayUrl || !pending.length) return;
    flushing.current = true;
    let sent = 0;
    try {
      for (const op of pending) { await post(op); sent++; }
      if (loud) notify(`Sent ${sent} change${sent === 1 ? '' : 's'} to Notion`);
    } catch {
      if (loud) notify('Relay unreachable — changes still queued');
    } finally {
      flushing.current = false;
      if (sent) setPending(p => p.slice(sent));
    }
  }, [pending, post, notify]);

  useEffect(() => { flush(); }, [flush, settings.relayUrl, settings.relayKey]);
  useEffect(() => {
    const onOnline = () => { flush(); };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [flush]);

  const relay = useCallback((op: RelayOp) => {
    if (!settingsRef.current.relayUrl) { setPending(p => [...p, op]); return; }
    post(op).catch(() => { setPending(p => [...p, op]); notify('Relay unreachable — change queued'); });
  }, [post, notify]);

  const updateTask = useCallback((id: string, patch: Partial<Task>) => {
    setTasks(ts => ts.map(t => (t.id === id ? { ...t, ...patch } : t)));
  }, []);

  /** Optimistic update + write-back. */
  const patch = useCallback((id: string, p: TaskPatch) => {
    updateTask(id, p);
    const prev = overlay.current[id];
    overlay.current[id] = { patch: { ...(prev?.patch || {}), ...p }, at: Date.now() };
    if (created.current[id]) created.current[id] = { ...created.current[id], ...p };
    writeJson('overlay', overlay.current);
    writeJson('created', created.current);
    relay({ kind: 'update', id, patch: p });
  }, [relay, updateTask]);

  const create = useCallback((task: Task) => {
    created.current[task.id] = task;
    writeJson('created', created.current);
    setTasks(ts => [...ts, task]);
    relay({ kind: 'create', id: task.id, action: task.action, owner: task.owner, due: task.due, priority: task.priority });
  }, [relay]);

  const remove = useCallback((id: string) => {
    delete created.current[id];
    writeJson('created', created.current);
    setTasks(ts => ts.filter(t => t.id !== id));
    setPending(p => p.filter(op => !(op.kind === 'create' && op.id === id)));
  }, []);

  /** Local-only manual order after drag-to-reorder (not synced). */
  const rank = useCallback((ranks: Record<string, number>) => {
    setTasks(ts => ts.map(t => (ranks[t.id] !== undefined ? { ...t, _rank: ranks[t.id] } : t)));
  }, []);

  return { tasks, loading, pending, patch, create, remove, rank, reload: load, flush };
}
