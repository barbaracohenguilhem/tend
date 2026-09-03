// Platform-neutral request handling for the tend API. Vercel (api/) and Netlify (netlify/functions/) both wrap this.
import { DATABASE_ID, DEACTIVATED, addComment, appendFile, createProperties, listComments, notion, pageToItem, patchToProperties, uploadFile } from './_lib.js';

/** @returns {{status:number, body:object}} */
export async function handle({ method, path, headers, body, query, raw }) {
  const get = k => String(headers[k] || headers[k.toLowerCase()] || '').trim();
  if (method === 'OPTIONS') return { status: 204, body: null };

  const password = process.env.TEAM_PASSWORD || 'APPCONTROLE';
  const domain = (process.env.ALLOWED_DOMAIN || 'carlaguilhem.com').toLowerCase();
  if (get('x-relay-key').toUpperCase() !== password.toUpperCase()) return { status: 401, body: { error: 'Wrong team password.' } };
  if (!get('x-user').toLowerCase().endsWith('@' + domain)) return { status: 401, body: { error: `Only @${domain} addresses can use this app.` } };
  if (DEACTIVATED.includes(get('x-user').toLowerCase())) return { status: 401, body: { error: 'This account is deactivated.' } };

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
    if (route === '/comments' && method === 'GET') {
      const id = String(query?.id || '').replace(/-/g, '');
      if (!/^[0-9a-f]{32}$/i.test(id)) return { status: 400, body: { error: 'Bad page id' } };
      return { status: 200, body: { comments: await listComments(id) } };
    }
    if (route === '/comments' && method === 'POST') {
      const id = String(body?.id || '').replace(/-/g, '');
      if (!/^[0-9a-f]{32}$/i.test(id)) return { status: 400, body: { error: 'Bad page id' } };
      const author = String(body?.author || get('x-user').split('@')[0] || 'tend').slice(0, 40);
      if (!body?.text && !body?.fileUploadId) return { status: 400, body: { error: 'Empty comment' } };
      return { status: 200, body: { comment: await addComment(id, author, body.text || '', body.fileUploadId) } };
    }
    if (route === '/upload' && method === 'POST') {
      // multipart: file + fields id, kind (deliverable | voice), author, text (for voice notes → also a chat message)
      if (!raw) return { status: 400, body: { error: 'No file' } };
      const { fields, file } = raw;
      const id = String(fields.id || '').replace(/-/g, '');
      if (!/^[0-9a-f]{32}$/i.test(id)) return { status: 400, body: { error: 'Bad page id' } };
      if (!file || !file.bytes?.length) return { status: 400, body: { error: 'No file' } };
      const uploadId = await uploadFile(file.name, file.type || 'application/octet-stream', file.bytes);
      const page = await notion(`pages/${id}`, undefined, 'GET');
      const prop = fields.kind === 'voice' ? 'Voice notes' : 'Deliverables';
      await appendFile(id, prop, uploadId, page.properties?.[prop]?.files);
      let comment = null;
      if (fields.kind === 'voice' || fields.text) {
        const author = String(fields.author || get('x-user').split('@')[0] || 'tend').slice(0, 40);
        comment = await addComment(id, author, fields.text || (fields.kind === 'voice' ? '🎤 voice note' : `📎 ${file.name}`), uploadId).catch(() => null);
      }
      return { status: 200, body: { ok: true, comment } };
    }
    if (route === '/create' && method === 'POST') {
      if (!body?.action) return { status: 400, body: { error: 'Missing action' } };
      const from = body.actor === 'barbara' ? 'Barbara' : 'Carla';
      const page = await notion('pages', { parent: { database_id: DATABASE_ID }, properties: createProperties(body, from) });
      return { status: 200, body: { id: String(page.id || '').replace(/-/g, '') } };
    }
    return { status: ['/', '/update', '/create', '/comments', '/upload'].includes(route) ? 405 : 404, body: { error: 'Not found' } };
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
