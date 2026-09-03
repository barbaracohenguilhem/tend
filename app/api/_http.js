// Shared request adapters: turn a platform request into { method, path, headers, body, query, raw } for _core.handle().

/** Parse multipart form data from a WHATWG Request into { fields, file }. */
export async function readMultipart(request) {
  const fd = await request.formData();
  const fields = {}; let file = null;
  for (const [k, v] of fd.entries()) {
    if (typeof v === 'string') fields[k] = v;
    else if (v && typeof v.arrayBuffer === 'function') file = { name: v.name || 'file', type: v.type || 'application/octet-stream', bytes: Buffer.from(await v.arrayBuffer()) };
  }
  return { fields, file };
}

/** Vercel Node function → core input (multipart is rebuilt as a Request so formData() can parse it). */
export async function fromNode(req) {
  const url = new URL(req.url, 'http://x');
  const ct = String(req.headers['content-type'] || '');
  let body, raw;
  if (ct.startsWith('multipart/form-data')) {
    const chunks = [];
    if (Buffer.isBuffer(req.body)) chunks.push(req.body);
    else if (typeof req.body === 'string') chunks.push(Buffer.from(req.body));
    else for await (const c of req) chunks.push(c);
    raw = await readMultipart(new Request('http://x' + req.url, { method: 'POST', headers: { 'content-type': ct }, body: Buffer.concat(chunks) }));
  } else {
    body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body;
  }
  return { method: req.method, path: url.pathname, headers: req.headers, body, query: Object.fromEntries(url.searchParams), raw };
}

/** Netlify / WHATWG Request → core input. */
export async function fromRequest(request) {
  const url = new URL(request.url);
  const headers = Object.fromEntries(request.headers.entries());
  const ct = headers['content-type'] || '';
  let body, raw;
  if (request.method === 'POST') {
    if (ct.startsWith('multipart/form-data')) raw = await readMultipart(request);
    else { try { body = await request.json(); } catch { body = {}; } }
  }
  return { method: request.method, path: url.pathname, headers, body, query: Object.fromEntries(url.searchParams), raw };
}
