import { useCallback, useEffect, useRef, useState } from 'react';
import type { McpError, McpNamespace, WatchEvent } from '../lib/claude';
import { readValue, writeJson } from '../lib/storage';
import type { Mode, RelayOp, Settings, Snapshot, Task, TaskPatch } from '../lib/types';
import { AUTHZ_CODES, NOTION_SERVER, QUERY_INPUT, TOOL_CREATE, TOOL_QUERY, TOOL_UPDATE, createInput, describeMcpError, patchToProperties, rowToTask } from './notion';
import { DEFAULT_DATA_URL } from './useSettings';

const POLL_MS = 60_000;
/** How long a locally applied patch keeps overriding a fresh snapshot (covers write → Notion → next poll lag). */
const OVERLAY_MS = 120_000;

export type Source = 'detecting' | 'notion' | 'relay' | 'none';
export interface Connection { status: 'connecting' | 'connected' | 'error'; message?: string; updatedAt?: number; partial?: boolean }

interface Overlay { patch: TaskPatch; at: number }

function normalize(t: Partial<Task> & Pick<Task, 'id'>): Task {
  return { action: '', subject: '', from: '', owner: 'none', priority: null, category: '', review: null, completed: false,
    feedback: null, gmail: null, draft: null, summary: '', time: null, due: null, ...t };
}

/**
 * Smart Inbox data. Inside claude.ai the page talks to the viewer's Notion connector directly (`mcp` capability);
 * self-hosted it reads a snapshot URL and posts to the n8n relay. Either way every change is applied optimistically
 * and queued while the backend is unreachable.
 */
export function useInbox(settings: Settings, mode: Mode, notify: (text: string) => void) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<Source>('detecting');
  const [connection, setConnection] = useState<Connection>({ status: 'connecting' });
  const [pending, setPending] = useState<RelayOp[]>(() => readValue<RelayOp[]>('pending', []));
  const mcp = useRef<McpNamespace | null>(null);
  const created = useRef<Record<string, Task>>(readValue('created', {}));
  const overlay = useRef<Record<string, Overlay>>(readValue('overlay', {}));
  /** local-… ids that Notion has since replaced with real page ids */
  const idMap = useRef<Record<string, string>>(readValue('idMap', {}));
  const pollTimer = useRef<number | undefined>(undefined);
  const flushing = useRef(false);
  const modeRef = useRef(mode); modeRef.current = mode;
  const settingsRef = useRef(settings); settingsRef.current = settings;
  const pendingRef = useRef(pending); pendingRef.current = pending;
  const tasksRef = useRef(tasks); tasksRef.current = tasks;

  useEffect(() => { writeJson('pending', pending); }, [pending]);

  // ---- which backend?
  useEffect(() => {
    let cancelled = false;
    const w = window;
    if (w.claude && typeof w.claude.use === 'function') {
      w.claude.use('mcp').then(ns => {
        if (cancelled) return;
        if (ns) { mcp.current = ns as McpNamespace; setSource('notion'); }
        else { setSource('none'); setLoading(false); setConnection({ status: 'error', message: 'Open this page inside claude.ai to connect to Notion.' }); }
      }).catch(() => { if (!cancelled) { setSource('none'); setLoading(false); } });
    } else {
      setSource('relay');
    }
    return () => { cancelled = true; };
  }, []);

  // ---- local overlay ------------------------------------------------------------------
  /** Re-apply everything the backend may not know about yet: queued ops, recent optimistic patches, local creates. */
  const applyLocal = useCallback((items: Task[]): Task[] => {
    const now = Date.now();
    const ids = new Set(items.map(t => t.id));
    const queued: Record<string, TaskPatch> = {};
    pendingRef.current.forEach(op => { if (op.kind === 'update') { const id = idMap.current[op.id] || op.id; queued[id] = { ...(queued[id] || {}), ...op.patch }; } });
    const out = items.map(t => {
      const o = overlay.current[t.id];
      const withOverlay = o && now - o.at < OVERLAY_MS ? { ...t, ...o.patch } : t;
      return queued[t.id] ? { ...withOverlay, ...queued[t.id] } : withOverlay;
    });
    Object.values(created.current).forEach(t => {
      const realId = idMap.current[t.id];
      if (ids.has(t.id) || (realId && ids.has(realId))) { delete created.current[t.id]; return; }
      const o = overlay.current[t.id];
      out.push(o ? { ...t, ...o.patch } : t);
    });
    writeJson('created', created.current);
    return out;
  }, []);

  // ---- relay backend (self-hosted) -----------------------------------------------------
  const headers = useCallback((json: boolean) => {
    const h: Record<string, string> = {};
    if (json) h['content-type'] = 'application/json';
    if (settingsRef.current.relayKey) h['x-relay-key'] = settingsRef.current.relayKey;
    return h;
  }, []);

  const loadRelay = useCallback(async () => {
    const url = settingsRef.current.dataUrl || DEFAULT_DATA_URL;
    const remote = /^https?:/i.test(url);
    try {
      const r = await fetch(url, { cache: 'no-store', headers: remote ? headers(false) : undefined });
      if (!r.ok) throw new Error(String(r.status));
      const j = (await r.json()) as Snapshot;
      setTasks(applyLocal((j.items || []).map(normalize)));
      setConnection({ status: 'connected', updatedAt: Date.now() });
    } catch {
      setConnection({ status: 'error', message: 'Could not load the Smart Inbox.' });
      notify('Could not load the Smart Inbox');
    } finally {
      setLoading(false);
    }
    window.clearTimeout(pollTimer.current);
    if (remote) pollTimer.current = window.setTimeout(loadRelay, POLL_MS);
  }, [applyLocal, headers, notify]);

  useEffect(() => {
    if (source !== 'relay') return;
    setLoading(true);
    loadRelay();
    const onVisible = () => { if (document.visibilityState === 'visible') loadRelay(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { document.removeEventListener('visibilitychange', onVisible); window.clearTimeout(pollTimer.current); };
  }, [source, loadRelay, settings.dataUrl, settings.relayKey]);

  // ---- Notion backend (inside claude.ai) ------------------------------------------------
  useEffect(() => {
    if (source !== 'notion' || !mcp.current) return;
    const ns = mcp.current;
    const onEvent = (ev: WatchEvent) => {
      if (ev.type === 'data') {
        const payload = (ev.result.payload || {}) as { results?: Record<string, unknown>[]; has_more?: boolean };
        const rows = Array.isArray(payload.results) ? payload.results : [];
        setTasks(applyLocal(rows.map(rowToTask)));
        setConnection({ status: 'connected', updatedAt: ev.result.cache?.storedAt ?? Date.now(), partial: !!payload.has_more });
      } else {
        const e = ev.error;
        if (AUTHZ_CODES.includes(e.code)) setTasks([]);
        setConnection(c => ({ status: 'error', message: describeMcpError(e), updatedAt: c.updatedAt }));
      }
      setLoading(false);
    };
    const unsub = ns.watchTool(NOTION_SERVER, TOOL_QUERY, QUERY_INPUT, onEvent, { refetchInterval: POLL_MS, cache: { staleTime: 20_000 } });
    return unsub;
  }, [source, applyLocal]);

  const reload = useCallback(() => {
    if (source === 'notion' && mcp.current) { mcp.current.invalidate(NOTION_SERVER, TOOL_QUERY).catch(() => undefined); }
    else if (source === 'relay') loadRelay();
  }, [source, loadRelay]);

  // ---- writes ---------------------------------------------------------------------------
  const realId = (id: string) => idMap.current[id] || id;

  const sendOp = useCallback(async (op: RelayOp) => {
    if (source === 'notion' && mcp.current) {
      const ns = mcp.current;
      if (op.kind === 'update') {
        const id = realId(op.id);
        if (id.startsWith('local-')) throw { code: 'not_created', message: 'Task not in Notion yet' } as McpError;
        const current = tasksRef.current.find(t => t.id === op.id || t.id === id);
        await ns.callTool(NOTION_SERVER, TOOL_UPDATE, { page_id: id, command: 'update_properties', properties: patchToProperties(op.patch, current) }, { cache: false });
      } else {
        const r = await ns.callTool(NOTION_SERVER, TOOL_CREATE, createInput(op, modeRef.current === 'carla' ? 'Carla' : 'Barbara'), { cache: false });
        const page = ((r.payload as { pages?: { id?: string }[] })?.pages || [])[0];
        if (page?.id) {
          const newId = page.id.replace(/-/g, '');
          idMap.current[op.id] = newId; writeJson('idMap', idMap.current);
          if (created.current[op.id]) { created.current[op.id] = { ...created.current[op.id], id: newId }; }
          setTasks(ts => ts.map(t => (t.id === op.id ? { ...t, id: newId } : t)));
        }
      }
      window.setTimeout(() => ns.invalidate(NOTION_SERVER, TOOL_QUERY).catch(() => undefined), 1500);
      return;
    }
    if (source === 'relay') {
      const base = settingsRef.current.relayUrl.replace(/\/$/, '');
      if (!base) throw new Error('no relay');
      const r = await fetch(`${base}/smart-inbox/${op.kind}`, { method: 'POST', headers: headers(true), body: JSON.stringify({ ...op, actor: modeRef.current }) });
      if (!r.ok) throw new Error(String(r.status));
      return;
    }
    throw new Error('no backend');
  }, [source, headers]);

  const canSend = source === 'notion' || (source === 'relay' && !!settings.relayUrl);

  /** Send queued ops in order; stop at the first failure and keep the rest queued. */
  const flush = useCallback(async (loud = false) => {
    if (flushing.current || !canSend || !pending.length) return;
    flushing.current = true;
    let sent = 0;
    try {
      for (const op of pending) { await sendOp(op); sent++; }
      if (loud) notify(`Sent ${sent} change${sent === 1 ? '' : 's'} to Notion`);
    } catch (e) {
      if (loud) notify(source === 'notion' ? describeMcpError(e as McpError) : 'Relay unreachable — changes still queued');
    } finally {
      flushing.current = false;
      if (sent) setPending(p => p.slice(sent));
    }
  }, [pending, sendOp, notify, canSend, source]);

  useEffect(() => { flush(); }, [flush, settings.relayUrl, settings.relayKey]);
  useEffect(() => {
    const onOnline = () => { flush(); };
    const onVisible = () => { if (document.visibilityState === 'visible') flush(); };
    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onVisible);
    return () => { window.removeEventListener('online', onOnline); document.removeEventListener('visibilitychange', onVisible); };
  }, [flush]);

  const relay = useCallback((op: RelayOp) => {
    if (!canSend) { setPending(p => [...p, op]); return; }
    if (pendingRef.current.length) { setPending(p => [...p, op]); return; } // keep order behind what is already queued
    sendOp(op).catch((e: McpError) => {
      setPending(p => [...p, op]);
      notify(source === 'notion' ? `Change queued — ${describeMcpError(e)}` : 'Relay unreachable — change queued');
    });
  }, [canSend, sendOp, notify, source]);

  const updateTask = useCallback((id: string, patch: Partial<Task>) => {
    setTasks(ts => ts.map(t => (t.id === id ? { ...t, ...patch } : t)));
  }, []);

  /** Optimistic update + write-back. */
  const patch = useCallback((id: string, p: TaskPatch) => {
    updateTask(id, p);
    const prev = overlay.current[id];
    overlay.current[id] = { patch: { ...(prev?.patch || {}), ...p }, at: Date.now() };
    const localId = Object.keys(idMap.current).find(k => idMap.current[k] === id) || id;
    if (created.current[localId]) created.current[localId] = { ...created.current[localId], ...p };
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

  return { tasks, loading, pending, source, connection, patch, create, remove, rank, reload, flush };
}
