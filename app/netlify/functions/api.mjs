import { CORS_HEADERS, handle } from '../../api/_core.js';
import { fromRequest } from '../../api/_http.js';

export const config = { path: ['/api/smart-inbox', '/api/smart-inbox/update', '/api/smart-inbox/create', '/api/smart-inbox/comments', '/api/smart-inbox/upload', '/api/smart-inbox/meta'] };

export default async function (request) {
  let input;
  try { input = await fromRequest(request); }
  catch (e) { return new Response(JSON.stringify({ error: 'Could not read the request: ' + (e && e.message ? e.message : 'bad body') }), { status: 400, headers: { ...CORS_HEADERS(request.headers.get('origin')), 'content-type': 'application/json' } }); }
  const out = await handle(input);
  const h = { ...CORS_HEADERS(input.headers.origin), 'content-type': 'application/json' };
  return new Response(out.body === null ? null : JSON.stringify(out.body), { status: out.status, headers: h });
}
