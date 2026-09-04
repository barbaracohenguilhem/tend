// Every minute: kick the background worker. The worker itself refuses to overlap a run still in progress.
export const config = { schedule: '* * * * *' };

export default async function () {
  if (!process.env.ANTHROPIC_API_KEY) return;
  const base = process.env.URL || process.env.DEPLOY_PRIME_URL;
  if (!base) return;
  const key = (process.env.LOLI_RUN_KEY || process.env.TEAM_PASSWORD || 'APPCONTROLE').trim();
  try { await fetch(`${base}/.netlify/functions/loli-run-background`, { method: 'POST', headers: { 'x-loli-key': key } }); }
  catch (e) { console.log('loli tick failed', e && e.message); }
}
