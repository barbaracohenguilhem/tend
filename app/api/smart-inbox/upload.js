import { CORS_HEADERS, handle } from '../_core.js';
import { fromNode } from '../_http.js';

export default async function handler(req, res) {
  Object.entries(CORS_HEADERS(req.headers.origin)).forEach(([k, v]) => res.setHeader(k, v));
  const out = await handle(await fromNode(req));
  if (out.body === null) { res.status(out.status).end(); return; }
  res.status(out.status).json(out.body);
}
