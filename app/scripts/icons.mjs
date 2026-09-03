import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = b => { let c = 0xffffffff; for (const x of b) c = crcTable[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const stops = [[0, [255,255,255]], [0.35, [247,200,214]], [0.7, [201,184,232]], [1, [168,197,240]]];
const grad = t => { for (let i = 1; i < stops.length; i++) if (t <= stops[i][0]) { const [t0, c0] = stops[i-1], [t1, c1] = stops[i]; return mix(c0, c1, (t - t0) / (t1 - t0)); } return stops[3][1]; };
function png(size, orbR, corner) {
  const paper = [246,244,239];
  const rows = [];
  const cx = size * 0.5, cy = size * 0.5, hx = cx - orbR * 0.3, hy = cy - orbR * 0.3;
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 4); row[0] = 0;
    for (let x = 0; x < size; x++) {
      // rounded-square mask
      const qx = Math.max(0, Math.abs(x - cx) - (cx - corner)), qy = Math.max(0, Math.abs(y - cy) - (cy - corner));
      const inSquare = Math.hypot(qx, qy) <= corner;
      let c = paper, a = inSquare ? 255 : 0;
      const d = Math.hypot(x - cx, y - cy);
      if (d <= orbR) {
        const t = Math.min(1, Math.hypot(x - hx, y - hy) / (orbR * 1.4));
        const g = grad(t);
        const edge = Math.min(1, orbR - d); // 1px antialias
        c = mix(paper, g, edge);
      }
      row[1 + x*4] = c[0]; row[2 + x*4] = c[1]; row[3 + x*4] = c[2]; row[4 + x*4] = a;
    }
    rows.push(row);
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(Buffer.concat(rows))), chunk('IEND', Buffer.alloc(0))]);
}
writeFileSync(new URL('../public/', import.meta.url).pathname + 'apple-touch-icon.png', png(180, 53, 0));   // iOS applies its own corner mask
writeFileSync(new URL('../public/', import.meta.url).pathname + 'icon-512.png', png(512, 150, 0));          // maskable: full-bleed paper, orb in safe zone
console.log('icons written');
