import { CORS_HEADERS, handle } from '../_core.js';

export default async function handler(req, res) {
  Object.entries(CORS_HEADERS(req.headers.origin)).forEach(([k, v]) => res.setHeader(k, v));
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body;
  const out = await handle({ method: req.method, path: req.url.split('?')[0], headers: req.headers, body });
  if (out.body === null) { res.status(out.status).end(); return; }
  res.status(out.status).json(out.body);
}
