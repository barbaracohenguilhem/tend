import { DATABASE_ID, authorize, cors, createProperties, fail, notion } from '../_lib.js';

/** POST /api/smart-inbox/create { action, owner, due, priority, actor } → { id } */
export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') { res.status(405).json({ error: 'POST only' }); return; }
  if (!authorize(req, res)) return;
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    if (!body.action) { res.status(400).json({ error: 'Missing action' }); return; }
    const from = body.actor === 'barbara' ? 'Barbara' : 'Carla';
    const page = await notion('pages', { parent: { database_id: DATABASE_ID }, properties: createProperties(body, from) });
    res.status(200).json({ id: String(page.id || '').replace(/-/g, '') });
  } catch (e) { fail(res, e); }
}
