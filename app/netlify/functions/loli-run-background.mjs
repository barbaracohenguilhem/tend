// The robot's worker: runs in the background (up to 15 minutes), started every minute by loli-tick or by hand with the key.
import { runOnce } from '../../api/loli/run.mjs';
import { blobState } from '../../api/loli/state.mjs';

const KEY = () => (process.env.LOLI_RUN_KEY || process.env.TEAM_PASSWORD || 'APPCONTROLE').trim();

export default async function (request) {
  const key = request.headers.get('x-loli-key') || new URL(request.url).searchParams.get('key') || '';
  if (key !== KEY()) return new Response('forbidden', { status: 403 });
  if ((process.env.LOLI_ENABLED || 'true').toLowerCase() === 'false') return new Response('disabled', { status: 200 });
  const url = new URL(request.url);
  const force = url.searchParams.get('force') === '1';
  const limit = Math.min(20, Math.max(1, Number(url.searchParams.get('limit') || 8)));
  const report = await runOnce({ state: blobState(), force, limit });
  console.log('loli run', JSON.stringify(report));
  return new Response(JSON.stringify(report), { status: 200, headers: { 'content-type': 'application/json' } });
}
