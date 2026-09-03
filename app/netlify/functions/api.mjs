import { CORS_HEADERS, handle } from '../../api/_core.js';
import { fromRequest } from '../../api/_http.js';

export const config = { path: ['/api/smart-inbox', '/api/smart-inbox/update', '/api/smart-inbox/create', '/api/smart-inbox/comments', '/api/smart-inbox/upload'] };

export default async function (request) {
  const input = await fromRequest(request);
  const out = await handle(input);
  const h = { ...CORS_HEADERS(input.headers.origin), 'content-type': 'application/json' };
  return new Response(out.body === null ? null : JSON.stringify(out.body), { status: out.status, headers: h });
}
