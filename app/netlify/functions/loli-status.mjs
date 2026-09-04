// What the robot has been doing: last runs, cursors, cost. GET with the team password in x-loli-key (or ?key=).
import { blobState } from '../../api/loli/state.mjs';
import { mailboxesFromEnv } from '../../api/loli/run.mjs';
import { notion } from '../../api/_lib.js';

export default async function (request) {
  const key = request.headers.get('x-loli-key') || new URL(request.url).searchParams.get('key') || '';
  if (key !== (process.env.LOLI_RUN_KEY || process.env.TEAM_PASSWORD || 'APPCONTROLE').trim()) return new Response('forbidden', { status: 403 });
  const state = blobState();
  const mailboxes = mailboxesFromEnv();
  const cursors = {}; for (const mb of mailboxes) cursors[mb.user] = await state.get(`cursor:${mb.user}`);
  const runs = (await state.get('runs')) || [];
  const ds = (process.env.LOLI_DATA_SOURCE_ID || 'd8a913b6-15ad-4c9c-beff-27e4c5188336').trim();
  const notionAccess = await notion(`data_sources/${ds}`, undefined, 'GET').then(d => `ok: ${(d.title || []).map(t => t.plain_text).join('') || ds}`).catch(e => `NO ACCESS — ${e.message}`);
  const body = {
    configured: { anthropicKey: !!process.env.ANTHROPIC_API_KEY, notionToken: !!process.env.NOTION_TOKEN, mailboxes: mailboxes.map(m => m.user), dataSource: process.env.LOLI_DATA_SOURCE_ID || 'd8a913b6-15ad-4c9c-beff-27e4c5188336 (shadow)', model: process.env.LOLI_MODEL || 'claude-opus-5', enabled: (process.env.LOLI_ENABLED || 'true') !== 'false', notionAccess },
    lock: await state.get('lock'), cursors,
    totals: { runs: runs.length, created: runs.reduce((n, r) => n + r.mailboxes.reduce((m, x) => m + (x.created || 0), 0), 0), updated: runs.reduce((n, r) => n + r.mailboxes.reduce((m, x) => m + (x.updated || 0), 0), 0), usd: Math.round(runs.reduce((n, r) => n + (r.usd || 0), 0) * 100) / 100 },
    lastRuns: runs.slice(0, 10),
    classified: ((await state.get('classified')) || []).slice(0, 10),
  };
  return new Response(JSON.stringify(body, null, 1), { status: 200, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
}
