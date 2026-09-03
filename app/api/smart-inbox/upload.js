import { CORS_HEADERS, handle } from '../_core.js';
import { fromNode } from '../_http.js';

/** Vercel must not pre-parse multipart bodies; the adapter reads the stream itself. */
export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  Object.entries(CORS_HEADERS(req.headers.origin)).forEach(([k, v]) => res.setHeader(k, v));
  let input;
  try { input = await fromNode(req); }
  catch (e) { res.status(400).json({ error: 'Could not read the request: ' + (e && e.message ? e.message : 'bad body') }); return; }
  const out = await handle(input);
  if (out.body === null) { res.status(out.status).end(); return; }
  res.status(out.status).json(out.body);
}
