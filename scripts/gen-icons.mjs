// Generates PWA PNG icons from the frog pixel map — pure Node, no deps.
// Hand-rolled PNG encoder (zlib + CRC32).
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MAPS } from '../src/render/sprites.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'icons');
mkdirSync(OUT, { recursive: true });

// ---- PNG encoding -----------------------------------------------------------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function encodePNG(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

// ---- drawing ------------------------------------------------------------------
function hex(h) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const COLORS = { G: hex('#3fae49'), L: hex('#7fd487'), W: hex('#f4fff4'), B: hex('#101418'), D: hex('#2a7d33') };

function makeIcon(size) {
  const rgba = Buffer.alloc(size * size * 4);
  const bg = hex('#12251a');
  const bg2 = hex('#1b4d26');
  const set = (x, y, [r, g, b], a = 255) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 4;
    rgba[i] = r; rgba[i + 1] = g; rgba[i + 2] = b; rgba[i + 3] = a;
  };
  // rounded-square background with subtle vertical gradient
  const radius = Math.floor(size * 0.18);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    // rounded rect mask
    const dx = Math.max(radius - x, x - (size - 1 - radius), 0);
    const dy = Math.max(radius - y, y - (size - 1 - radius), 0);
    if (dx * dx + dy * dy > radius * radius) continue;
    const t = y / size;
    set(x, y, [bg[0] + (bg2[0] - bg[0]) * t * 0.5, bg[1] + (bg2[1] - bg[1]) * t * 0.5, bg[2] + (bg2[2] - bg[2]) * t * 0.5]);
  }
  // frog, scaled to ~72% of the icon, centered
  const map = MAPS.frog;
  const scale = Math.floor((size * 0.72) / 16);
  const fw = 16 * scale, fh = 16 * scale;
  const ox = Math.floor((size - fw) / 2), oy = Math.floor((size - fh) / 2);
  for (let my = 0; my < 16; my++) for (let mx = 0; mx < 16; mx++) {
    const col = COLORS[map[my][mx]];
    if (!col) continue;
    for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) {
      set(ox + mx * scale + dx, oy + my * scale + dy, col);
    }
  }
  return encodePNG(size, size, rgba);
}

for (const size of [180, 192, 512]) {
  const file = join(OUT, `icon-${size}.png`);
  writeFileSync(file, makeIcon(size));
  console.log('wrote', file);
}
