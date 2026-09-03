// Platform-neutral request handling for the tend API. Vercel (api/) and Netlify (netlify/functions/) both wrap this.
import { DATABASE_ID, createProperties, notion, pageToItem, patchToProperties } from './_lib.js';

/** @returns {{status:number, body:object}} */
export async function handle({ method, path, headers, body }) {
  const get = k => String(headers[k] || headers[k.toLowerCase()] || '').trim();
  if (method === 'OPTIONS') return { status: 204, body: null };

  const password = process.env.TEAM_PASSWORD || 'APPCONTROLE';
  const domain = (process.env.ALLOWED_DOMAIN || 'carlaguilhem.com').toLowerCase();
  if (get('x-relay-key').toUpperCase() !== password.toUpperCase()) return { status: 401, body: { error: 'Wrong team password.' } };
  if (!get('x-user').toLowerCase().endsWith('@' + domain)) return { status: 401, body: { error: `Only @${domain} addresses can use this app.` } };

  const route = path.replace(/\/+$/, '').replace(/^.*\/api\/smart-inbox/, '') || '/';
  try {
    if (route === '/' && method === 'GET') {
      const items = []; let cursor;
      for (let page = 0; page < 5; page++) {
        const j = await notion(`databases/${DATABASE_ID}/query`, {
          page_size: 100, start_cursor: cursor,
          filter: { and: [{ property: 'Action required', checkbox: { equals: true } }, { property: 'Completed', checkbox: { equals: false } }] },
          sorts: [{ property: 'Priority', direction: 'ascending' }, { property: 'Due date', direction: 'ascending' }],
        });
        (j.results || []).forEach(p => items.push(pageToItem(p)));
        if (!j.has_more || !j.next_cursor) break;
        cursor = j.next_cursor;
      }
      return { status: 200, body: { fetchedAt: new Date().toISOString(), items } };
    }
    if (route === '/update' && method === 'POST') {
      const id = String(body?.id || '').replace(/-/g, '');
      if (!/^[0-9a-f]{32}$/i.test(id)) return { status: 400, body: { error: 'Bad page id' } };
      const properties = patchToProperties(body?.patch || {}, body?.current);
      if (!Object.keys(properties).length) return { status: 200, body: { id, noop: true } };
      await notion(`pages/${id}`, { properties }, 'PATCH');
      return { status: 200, body: { id } };
    }
    if (route === '/create' && method === 'POST') {
      if (!body?.action) return { status: 400, body: { error: 'Missing action' } };
      const from = body.actor === 'barbara' ? 'Barbara' : 'Carla';
      const page = await notion('pages', { parent: { database_id: DATABASE_ID }, properties: createProperties(body, from) });
      return { status: 200, body: { id: String(page.id || '').replace(/-/g, '') } };
    }
    return { status: route === '/' || route === '/update' || route === '/create' ? 405 : 404, body: { error: route === '/' ? 'GET only' : 'Not found' } };
  } catch (e) {
    return { status: e && e.status ? e.status : 500, body: { error: e && e.message ? e.message : 'Server error' } };
  }
}

export const CORS_HEADERS = origin => ({
  'Access-Control-Allow-Origin': origin || '*',
  'Access-Control-Allow-Headers': 'content-type, x-relay-key, x-user',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Cache-Control': 'no-store',
});
