import { authorize, cors, fail, notion, patchToProperties } from '../_lib.js';

/** POST /api/smart-inbox/update { id, patch, actor } → { id } */
export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') { res.status(405).json({ error: 'POST only' }); return; }
  if (!authorize(req, res)) return;
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const id = String(body.id || '').replace(/-/g, '');
    if (!/^[0-9a-f]{32}$/i.test(id)) { res.status(400).json({ error: 'Bad page id' }); return; }
    const properties = patchToProperties(body.patch || {}, body.current);
    if (!Object.keys(properties).length) { res.status(200).json({ id, noop: true }); return; }
    await notion(`pages/${id}`, { properties }, 'PATCH');
    res.status(200).json({ id });
  } catch (e) { fail(res, e); }
}
