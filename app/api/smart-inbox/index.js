import { DATABASE_ID, authorize, cors, fail, notion, pageToItem } from '../_lib.js';

/** GET /api/smart-inbox → { fetchedAt, items } — every open, action-required item, priority then due. */
export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'GET') { res.status(405).json({ error: 'GET only' }); return; }
  if (!authorize(req, res)) return;
  try {
    const items = [];
    let cursor;
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
    res.status(200).json({ fetchedAt: new Date().toISOString(), items });
  } catch (e) { fail(res, e); }
}
