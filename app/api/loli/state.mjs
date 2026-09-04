// Durable state for the robot: Netlify Blobs in production, an in-memory map in tests.
import { getStore } from '@netlify/blobs';

export function blobState(name = 'loli') {
  const store = getStore(name);
  return {
    async get(key, fallback = null) { const v = await store.get(key, { type: 'json' }); return v === null || v === undefined ? fallback : v; },
    async set(key, value) { await store.setJSON(key, value); },
    /** Keys under a prefix, newest first by name (callers put a sortable timestamp in the key). */
    async list(prefix) { const r = await store.list({ prefix }); return (r.blobs || []).map(b => b.key).sort().reverse(); },
  };
}

export function memoryState(seed = {}) {
  const m = new Map(Object.entries(seed));
  return { async get(k, f = null) { return m.has(k) ? m.get(k) : f; }, async set(k, v) { m.set(k, v); }, async list(prefix) { return [...m.keys()].filter(k => k.startsWith(prefix)).sort().reverse(); }, dump: () => Object.fromEntries(m) };
}
