// fetch() that opens a brand-new connection, with a fresh TLS handshake, for every request.
//
// Node's built-in fetch (undici) pools sockets and caches TLS sessions per host so later connections resume
// them. Against the Anthropic API from a warm serverless container that goes wrong: after the first one or
// two calls every new connection dies in the handshake with "tlsv1 alert internal error" (the server
// rejects the resumed session), the bad session stays cached, and every attempt — SDK retries included —
// fails at once with "Connection error." until the container is recycled. A full handshake costs ~100 ms,
// nothing next to a model call, so the robot never reuses connections or sessions.
import http from 'node:http';
import https from 'node:https';
import { Readable } from 'node:stream';

/** Build a fetch() with its own agents. `agentOptions` are passed to node:https (tests use rejectUnauthorized). */
export function makeFetch(agentOptions = {}) {
  const agents = {
    'http:': new http.Agent({ keepAlive: false }),
    'https:': new https.Agent({ keepAlive: false, maxCachedSessions: 0, ...agentOptions }),
  };
  return async function fetchFresh(input, init = {}) {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    const mod = url.protocol === 'http:' ? http : url.protocol === 'https:' ? https : null;
    if (!mod) throw new TypeError(`unsupported protocol ${url.protocol}`);
    const method = String(init.method || 'GET').toUpperCase();
    const headers = {};
    new Headers(init.headers || {}).forEach((v, k) => { headers[k] = v; });
    const body = await toBuffer(init.body);
    if (body && headers['content-length'] === undefined) headers['content-length'] = String(body.length);
    return new Promise((resolve, reject) => {
      const req = mod.request(url, { method, headers, agent: agents[url.protocol], signal: init.signal }, res => {
        const h = new Headers();
        for (const [k, v] of Object.entries(res.headers)) { if (Array.isArray(v)) v.forEach(x => h.append(k, x)); else if (v !== undefined) h.set(k, v); }
        const noBody = method === 'HEAD' || res.statusCode === 204 || res.statusCode === 205 || res.statusCode === 304;
        if (noBody) res.resume();
        resolve(new Response(noBody ? null : Readable.toWeb(res), { status: res.statusCode, statusText: res.statusMessage || '', headers: h }));
      });
      req.on('error', reject);
      if (body) req.end(body); else req.end();
    });
  };
}

export const fetchFresh = makeFetch();

async function toBuffer(body) {
  if (body == null) return null;
  if (typeof body === 'string') return Buffer.from(body);
  if (Buffer.isBuffer(body)) return body;
  if (body instanceof ArrayBuffer) return Buffer.from(body);
  if (ArrayBuffer.isView(body)) return Buffer.from(body.buffer, body.byteOffset, body.byteLength);
  if (typeof body.arrayBuffer === 'function') return Buffer.from(await body.arrayBuffer());
  if (typeof body[Symbol.asyncIterator] === 'function') { const chunks = []; for await (const c of body) chunks.push(Buffer.from(c)); return Buffer.concat(chunks); }
  throw new TypeError('unsupported request body');
}
