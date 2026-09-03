import { CORS_HEADERS, handle } from '../../api/_core.js';

export const config = { path: ['/api/smart-inbox', '/api/smart-inbox/update', '/api/smart-inbox/create'] };

export default async function (request) {
  const url = new URL(request.url);
  const headers = Object.fromEntries(request.headers.entries());
  let body;
  if (request.method === 'POST') { try { body = await request.json(); } catch { body = {}; } }
  const out = await handle({ method: request.method, path: url.pathname, headers, body });
  const h = { ...CORS_HEADERS(headers.origin), 'content-type': 'application/json' };
  return new Response(out.body === null ? null : JSON.stringify(out.body), { status: out.status, headers: h });
}
