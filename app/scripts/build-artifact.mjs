// Inlines the Vite build into one HTML fragment for publishing as a claude.ai Artifact
// (the Artifact wraps it in its own <html>/<head>/<body>; scripts and styles must be inline, fonts from Google).
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const dist = new URL('../dist/', import.meta.url).pathname;
const assets = join(dist, 'assets');
const js = readdirSync(assets).filter(f => f.endsWith('.js')).map(f => readFileSync(join(assets, f), 'utf8')).join('\n');
let css = readdirSync(assets).filter(f => f.endsWith('.css')).map(f => readFileSync(join(assets, f), 'utf8')).join('\n');

const fontLinks = [];
css = css.replace(/@import\s*(?:url\()?(['"]?)(https?:[^'")]+)\1\)?[^;]*;/g, (_, __, url) => { fontLinks.push(url); return ''; });

const html = [
  '<title>tend</title>',
  ...fontLinks.map(u => `<link rel="stylesheet" href="${u}">`),
  `<style>\n${css}\n</style>`,
  '<div id="root"></div>',
  `<script type="module">\n${js.replace(/<\/script/gi, '<\\/script')}\n</script>`,
].join('\n');

const out = join(dist, 'tend-artifact.html');
writeFileSync(out, html);
console.log(`wrote ${out} (${(html.length / 1024).toFixed(0)} KB)`);
