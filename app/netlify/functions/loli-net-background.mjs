// Network probe for the robot (key-protected, background). For `seconds`, every 2 s: resolve `host`, then for each
// address do a bare TLS handshake and one HTTPS GET, recording success or the exact failure. Results are stored under
// `net:last` and shown by loli-status as `net`, so a failing edge address can be told apart from a client-side problem.
import dns from 'node:dns/promises';
import https from 'node:https';
import tls from 'node:tls';
import { blobState } from '../../api/loli/state.mjs';

export default async function (request) {
  const url = new URL(request.url);
  const key = request.headers.get('x-loli-key') || url.searchParams.get('key') || '';
  if (key !== (process.env.LOLI_RUN_KEY || process.env.TEAM_PASSWORD || 'APPCONTROLE').trim()) return new Response('forbidden', { status: 403 });
  const host = url.searchParams.get('host') || 'api.anthropic.com';
  const seconds = Math.min(Number(url.searchParams.get('seconds')) || 120, 600);
  const state = blobState();
  const log = { host, node: process.version, openssl: process.versions.openssl, startedAt: new Date().toISOString(), samples: [] };
  const end = Date.now() + seconds * 1000;
  while (Date.now() < end) {
    const sample = { uptime: Math.round(process.uptime()), at: new Date().toISOString() };
    try { sample.lookup = (await dns.lookup(host, { all: true })).map(a => a.address); } catch (e) { sample.lookupError = e.message; }
    try { sample.resolve4 = await dns.resolve4(host, { ttl: true }); } catch (e) { sample.resolveError = e.message; }
    try { sample.resolve6 = await dns.resolve6(host); } catch (e) { sample.resolve6Error = e.code || e.message; }
    sample.probes = [];
    for (const ip of sample.lookup || []) sample.probes.push({ ip, handshake: await handshake(ip, host), get: await get(ip, host) });
    log.samples.push(sample);
    await state.set('net:last', log);
    await new Promise(r => setTimeout(r, 2000));
  }
  log.finishedAt = new Date().toISOString();
  await state.set('net:last', log);
  return new Response(JSON.stringify(log), { status: 200, headers: { 'content-type': 'application/json' } });
}

function handshake(ip, servername) {
  return new Promise(resolve => {
    const started = Date.now();
    const s = tls.connect({ host: ip, port: 443, servername, timeout: 8000 }, () => { resolve({ ok: true, ms: Date.now() - started, proto: s.getProtocol(), cipher: (s.getCipher() || {}).name }); s.end(); });
    s.on('error', e => resolve({ ok: false, ms: Date.now() - started, error: `${e.code || ''} ${e.message}`.trim().slice(0, 300) }));
    s.on('timeout', () => { resolve({ ok: false, ms: Date.now() - started, error: 'timeout' }); s.destroy(); });
  });
}

function get(ip, host) {
  return new Promise(resolve => {
    const started = Date.now();
    const agent = new https.Agent({ keepAlive: false, maxCachedSessions: 0 });
    const req = https.request({ host: ip, servername: host, port: 443, path: '/v1/models', method: 'GET', headers: { host, 'user-agent': 'tend-loli-net-probe' }, agent, timeout: 10000 }, res => {
      res.resume(); res.on('end', () => resolve({ ok: true, status: res.statusCode, ms: Date.now() - started }));
    });
    req.on('error', e => resolve({ ok: false, ms: Date.now() - started, error: `${e.code || ''} ${e.message}`.trim().slice(0, 300) }));
    req.on('timeout', () => { resolve({ ok: false, ms: Date.now() - started, error: 'timeout' }); req.destroy(); });
    req.end();
  });
}
