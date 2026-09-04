// Durable state for the robot: Netlify Blobs in production, an in-memory map in tests.
import { getStore } from '@netlify/blobs';

export function blobState(name = 'loli') {
  const store = getStore(name);
  return {
    async get(key, fallback = null) { const v = await store.get(key, { type: 'json' }); return v === null || v === undefined ? fallback : v; },
    async set(key, value) { await store.setJSON(key, value); },
  };
}

export function memoryState(seed = {}) {
  const m = new Map(Object.entries(seed));
  return { async get(k, f = null) { return m.has(k) ? m.get(k) : f; }, async set(k, v) { m.set(k, v); }, dump: () => Object.fromEntries(m) };
}
