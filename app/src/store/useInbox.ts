import { useCallback, useEffect, useRef, useState } from 'react';
import type { McpError, McpNamespace, WatchEvent } from '../lib/claude';
import { readValue, writeJson } from '../lib/storage';
import type { Mode, RelayOp, Settings, Snapshot, Task, TaskPatch } from '../lib/types';
import { AUTHZ_CODES, NOTION_SERVER, QUERY_INPUT, TOOL_CREATE, TOOL_QUERY, TOOL_UPDATE, createInput, describeMcpError, patchToProperties, rowToTask } from './notion';
import { API_BASE, DEFAULT_DATA_URL } from './useSettings';
import { TEAM_PASSWORD, readSession } from '../lib/auth';
import { hasApi } from '../lib/api';

const POLL_MS = 60_000;
/** How long a locally applied patch keeps overriding a fresh snapshot (covers write → Notion → next poll lag). */
const OVERLAY_MS = 120_000;

export type Source = 'detecting' | 'notion' | 'relay' | 'none';
export interface Connection { status: 'connecting' | 'connected' | 'error'; message?: string; updatedAt?: number; partial?: boolean }

interface Overlay { patch: TaskPatch; at: number }

const two = (n: number) => String(n).padStart(2, '0');
/** A Notion datetime with its offset → this phone's local date and clock. */
function localDue(dueAt: string): { due: string; time: string } | null {
  const d = new Date(dueAt);
  if (Number.isNaN(d.getTime())) return null;
  return { due: `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`, time: `${two(d.getHours())}:${two(d.getMinutes())}` };
}
/** Offset of this phone at a given local date/time (not "now"), so dates around DST changes keep their clock. */
function tzAt(due: string, time: string | null): string {
  const d = new Date(`${due}T${time || '12:00'}:00`);
  const off = -(Number.isNaN(d.getTime()) ? new Date() : d).getTimezoneOffset();
  const sgn = off >= 0 ? '+' : '-', a = Math.abs(off);
  return `${sgn}${two(Math.floor(a / 60))}:${two(a % 60)}`;
}

function normalize(t: Partial<Task> & Pick<Task, 'id'>): Task {
  const base: Task = { action: '', subject: '', from: '', owner: 'none', priority: null, category: '', review: null, completed: false,
    feedback: null, gmail: null, draft: null, summary: '', time: null, due: null, ...t };
  if (base.dueAt && /T/.test(base.dueAt)) { const l = localDue(base.dueAt); if (l) { base.due = l.due; base.time = l.time; } }
  return base;
}

/** Errors the server will never accept, whatever we do: drop the change instead of retrying it forever. */
class PermanentError extends Error { permanent = true; }
const isPermanent = (e: unknown) => !!e && typeof e === 'object' && (e as { permanent?: boolean }).permanent === true;

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
  /** Sends go out one at a time, in the order they were made, so two quick edits cannot overtake each other. */
  const chain = useRef<Promise<void>>(Promise.resolve());
  /** Local ids whose create request is on the wire right now. */
  const inflight = useRef<Set<string>>(new Set());
  /** Local ids the user undid while their create was in flight: archive them as soon as Notion answers. */
  const removed = useRef<Set<string>>(new Set());
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
    Object.entries(created.current).forEach(([key, t]) => {
      const realId = idMap.current[key] || idMap.current[t.id];
      if (ids.has(t.id) || (realId && ids.has(realId)) || removed.current.has(key)) { delete created.current[key]; return; }
      const o = overlay.current[key] || overlay.current[t.id];
      out.push(o ? { ...t, ...o.patch } : t);
    });
    writeJson('created', created.current);
    return out;
  }, []);

  // ---- relay backend (self-hosted) -----------------------------------------------------
  const headers = useCallback((json: boolean) => {
    const h: Record<string, string> = {};
    if (json) h['content-type'] = 'application/json';
    const session = readSession();
    const key = settingsRef.current.relayKey || (session && session.key) || (API_BASE ? TEAM_PASSWORD : '');
    if (key) h['x-relay-key'] = key;
    if (session) h['x-user'] = session.email;
    return h;
  }, []);

  const loadRelay = useCallback(async () => {
    const url = settingsRef.current.dataUrl || DEFAULT_DATA_URL;
    const remote = /^https?:/i.test(url) || (!!API_BASE && url.startsWith(API_BASE));
    try {
      const r = await fetch(url, { cache: 'no-store', headers: remote ? headers(false) : undefined });
      if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error((j as { error?: string }).error || String(r.status)); }
      const j = (await r.json()) as Snapshot;
      setTasks(applyLocal((j.items || []).map(normalize)));
      setConnection({ status: 'connected', updatedAt: Date.now() });
    } catch (e) {
      const msg = e instanceof Error && e.message && !/^\d+$/.test(e.message) ? e.message : 'Could not load the Smart Inbox.';
      setConnection({ status: 'error', message: msg });
      notify(msg);
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
  const pollFallback = useRef(false);
  const applyNotionPayload = useCallback((payload: unknown, storedAt?: number) => {
    const p = (payload || {}) as { results?: Record<string, unknown>[]; has_more?: boolean };
    const rows = Array.isArray(p.results) ? p.results : [];
    setTasks(applyLocal(rows.map(rowToTask)));
    setConnection({ status: 'connected', updatedAt: storedAt ?? Date.now(), partial: !!p.has_more });
    setLoading(false);
  }, [applyLocal]);
  const applyNotionError = useCallback((e: McpError) => {
    if (AUTHZ_CODES.includes(e.code)) setTasks([]);
    setConnection(c => ({ status: 'error', message: describeMcpError(e), updatedAt: c.updatedAt }));
    setLoading(false);
  }, []);

  /** Plain-call polling, used when the viewer cannot register a live watch for the query tool. */
  const pollNotion = useCallback(async () => {
    const ns = mcp.current; if (!ns) return;
    try {
      const r = await ns.callTool(NOTION_SERVER, TOOL_QUERY, QUERY_INPUT, { cache: { staleTime: 20_000 } });
      applyNotionPayload(r.payload, r.cache?.storedAt);
    } catch (e) { applyNotionError(e as McpError); }
    window.clearTimeout(pollTimer.current);
    pollTimer.current = window.setTimeout(pollNotion, POLL_MS);
  }, [applyNotionPayload, applyNotionError]);

  useEffect(() => {
    if (source !== 'notion' || !mcp.current) return;
    const ns = mcp.current;
    let unsub: (() => void) | null = null;
    const onVisible = () => { if (document.visibilityState === 'visible' && pollFallback.current) pollNotion(); };
    document.addEventListener('visibilitychange', onVisible);
    const startPolling = () => { if (pollFallback.current) return; pollFallback.current = true; if (unsub) { unsub(); unsub = null; } pollNotion(); };
    const onEvent = (ev: WatchEvent) => {
      if (ev.type === 'data') { applyNotionPayload(ev.result.payload, ev.result.cache?.storedAt); return; }
      // A watch the shell cannot register (older shell, non-read annotation, watch limit) → fall back to polling.
      if (ev.error.code === 'bad_request' || ev.error.code === 'internal') { startPolling(); return; }
      applyNotionError(ev.error);
    };
    unsub = ns.watchTool(NOTION_SERVER, TOOL_QUERY, QUERY_INPUT, onEvent, { refetchInterval: POLL_MS, cache: { staleTime: 20_000 } });
    return () => { if (unsub) unsub(); document.removeEventListener('visibilitychange', onVisible); window.clearTimeout(pollTimer.current); pollFallback.current = false; };
  }, [source, applyNotionPayload, applyNotionError, pollNotion]);

  const reload = useCallback(() => {
    if (source === 'notion' && mcp.current) {
      if (pollFallback.current) { mcp.current.invalidate(NOTION_SERVER, TOOL_QUERY).catch(() => undefined).then(pollNotion); }
      else mcp.current.invalidate(NOTION_SERVER, TOOL_QUERY).catch(() => undefined);
    } else if (source === 'relay') loadRelay();
  }, [source, loadRelay, pollNotion]);

  // ---- writes ---------------------------------------------------------------------------
  const realId = (id: string) => idMap.current[id] || id;

  const sendOp = useCallback(async (op: RelayOp) => {
    if (source === 'notion' && mcp.current) {
      const ns = mcp.current;
      if (op.kind === 'comment' || op.kind === 'archive') return; // not supported through the connector
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
      window.setTimeout(() => { ns.invalidate(NOTION_SERVER, TOOL_QUERY).catch(() => undefined).then(() => { if (pollFallback.current) pollNotion(); }); }, 1500);
      return;
    }
    if (source === 'relay') {
      const base = settingsRef.current.relayUrl.replace(/\/$/, '');
      if (!base) throw new Error('no relay');
      const mapId = (id: string) => idMap.current[id] || id;
      const stillLocal = (id: string | null | undefined) => !!id && id.startsWith('local-');
      const post = async (route: string, payload: unknown) => {
        let r: Response;
        try { r = await fetch(`${base}/smart-inbox/${route}`, { method: 'POST', headers: headers(true), body: JSON.stringify(payload) }); }
        catch (e) { throw new Error(e instanceof Error && e.message ? e.message : 'server unreachable'); }
        const j = await r.json().catch(() => ({})) as { id?: string; error?: string };
        if (!r.ok) {
          const msg = j.error || String(r.status);
          if (r.status === 400 || r.status === 403 || r.status === 404 || r.status === 422) throw new PermanentError(msg);
          throw new Error(msg);
        }
        return j;
      };
      if (op.kind === 'update') {
        const id = mapId(op.id);
        if (stillLocal(id)) throw new Error('waiting for the task to reach Notion');
        const patch: TaskPatch & { tz?: string } = { ...op.patch };
        if (patch.parentId) patch.parentId = mapId(patch.parentId);
        if (patch.dependsOn) patch.dependsOn = patch.dependsOn.map(mapId);
        if (stillLocal(patch.parentId) || (patch.dependsOn || []).some(stillLocal)) throw new Error('waiting for a linked task to reach Notion');
        const current = tasksRef.current.find(t => t.id === op.id || t.id === id);
        const due = patch.due !== undefined ? patch.due : current?.due ?? null;
        const time = patch.time !== undefined ? patch.time : current?.time ?? null;
        if (due && time) patch.tz = tzAt(due, time);
        await post('update', { kind: 'update', id, patch, current, actor: modeRef.current });
        return;
      }
      if (op.kind === 'archive') {
        const id = mapId(op.id);
        if (stillLocal(id)) return; // never reached Notion — nothing to archive
        await post('update', { id, archive: true });
        return;
      }
      if (op.kind === 'comment') {
        const id = mapId(op.id);
        if (stillLocal(id)) throw new Error('waiting for the task to reach Notion');
        await post('comments', { id, author: op.author, text: op.text });
        return;
      }
      // create
      if (removed.current.has(op.id)) { removed.current.delete(op.id); return; } // undone before it was ever sent
      const parentId = op.parentId ? mapId(op.parentId) : null;
      if (stillLocal(parentId)) throw new Error('waiting for the parent task to reach Notion');
      const tz = op.due && op.time ? tzAt(op.due, op.time) : undefined;
      inflight.current.add(op.id);
      let j: { id?: string };
      try { j = await post('create', { ...op, parentId, tz, actor: modeRef.current }); }
      finally { inflight.current.delete(op.id); }
      if (j.id && j.id !== op.id) {
        idMap.current[op.id] = j.id; writeJson('idMap', idMap.current);
        if (created.current[op.id]) created.current[op.id] = { ...created.current[op.id], id: j.id };
        setTasks(ts => ts.map(t => (t.id === op.id ? { ...t, id: j.id as string, parentId: t.parentId ? mapId(t.parentId) : t.parentId } : t)));
        if (removed.current.has(op.id)) { removed.current.delete(op.id); await post('update', { id: j.id, archive: true }).catch(() => undefined); }
      }
      return;
    }
    throw new Error('no backend');
  }, [source, headers, pollNotion]);

  const canSend = source === 'notion' || (source === 'relay' && !!settings.relayUrl);

  /** Send queued ops in order; stop at the first retryable failure and keep the rest queued. Changes the server will never accept are dropped, loudly. */
  const flush = useCallback(async (loud = false) => {
    if (flushing.current || !canSend || !pending.length) return;
    flushing.current = true;
    let done = 0, sent = 0;
    try {
      for (const op of pending) {
        try { await sendOp(op); sent++; done++; }
        catch (e) {
          if (isPermanent(e)) { done++; notify(`A change was refused by Notion and dropped — ${(e as Error).message}`); continue; }
          throw e;
        }
      }
      if (loud) notify(`Sent ${sent} change${sent === 1 ? '' : 's'} to Notion`);
    } catch (e) {
      if (loud) notify(source === 'notion' ? describeMcpError(e as McpError) : `Still queued — ${e instanceof Error ? e.message : 'server unreachable'}`);
    } finally {
      flushing.current = false;
      if (done) setPending(p => p.slice(done));
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
    chain.current = chain.current.then(async () => {
      if (pendingRef.current.length) { setPending(p => [...p, op]); return; } // something ahead of us got queued meanwhile
      try { await sendOp(op); }
      catch (e) {
        if (isPermanent(e)) { notify(`Notion refused that change — ${(e as Error).message}`); return; }
        setPending(p => [...p, op]);
        notify(source === 'notion' ? `Change queued — ${describeMcpError(e as McpError)}` : `Change queued — ${e instanceof Error && e.message ? e.message : 'server unreachable'}`);
      }
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

  const create = useCallback((task: Task, extra?: { ownerName?: string | null; from?: string | null }) => {
    created.current[task.id] = task;
    writeJson('created', created.current);
    setTasks(ts => [...ts, task]);
    relay({ kind: 'create', id: task.id, action: task.action, owner: task.owner, due: task.due, time: task.time ?? null, priority: task.priority, parentId: task.parentId ?? null, ownerName: extra?.ownerName ?? null, from: extra?.from ?? null, project: task.project ?? null, category: task.category || null });
  }, [relay]);

  /** Undo a local add: forget it here and, if Notion already has it (or is about to), archive the page. */
  const remove = useCallback((id: string) => {
    delete created.current[id];
    writeJson('created', created.current);
    const realId = idMap.current[id];
    setTasks(ts => ts.filter(t => t.id !== id && t.id !== realId));
    const queued = pendingRef.current.some(op => op.kind === 'create' && op.id === id);
    setPending(p => p.filter(op => op.id !== id));
    if (realId) relay({ kind: 'archive', id: realId });
    else if (!queued) removed.current.add(id); // in flight (or already sent): archive when the id comes back
  }, [relay]);

  /** A note on the task's Notion page, queued like any other change so it is not lost offline. */
  const comment = useCallback((id: string, text: string, author: string) => {
    if (!hasApi && source !== 'relay') return;
    relay({ kind: 'comment', id, text, author });
  }, [relay, source]);

  /** Local-only manual order after drag-to-reorder (not synced). */
  const rank = useCallback((ranks: Record<string, number>) => {
    setTasks(ts => ts.map(t => (ranks[t.id] !== undefined ? { ...t, _rank: ranks[t.id] } : t)));
  }, []);

  /** The id a task is known by now: a local id becomes the Notion page id once the create has gone through. */
  const resolve = useCallback((id: string | null) => (id ? idMap.current[id] || id : id), []);

  return { tasks, loading, pending, source, connection, patch, create, remove, comment, rank, reload, flush, resolve };
}
