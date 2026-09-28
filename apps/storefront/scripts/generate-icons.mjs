// Generates all Shopfront PWA icons as real PNGs — zero dependencies.
// Pure-JS rasterizer: gradient background, rounded mask, white shopping-bag glyph.
// Run: node scripts/generate-icons.mjs  (from apps/storefront)
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public', 'icons');
mkdirSync(outDir, { recursive: true });

// ---------- minimal PNG encoder ----------
function crc32(buf) {
  let c, table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
  }
  let crc = -1;
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  return (crc ^ -1) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function encodePNG(rgba, w, h) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0; // no filter
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

// ---------- Shopfront icon painter ----------
// bg gradient #1D4ED8 -> #3B82F6 (top-left to bottom-right), white bag glyph.
const A = [0x1d, 0x4e, 0xd8];
const B = [0x3b, 0x82, 0xf6];

function paintIcon(size, { maskable = false } = {}) {
  const px = Buffer.alloc(size * size * 4);
  const r = maskable ? 0 : size * 0.1875; // rounded-corner radius (OS masks handle maskable)
  const pad = maskable ? size * 0.24 : size * 0.2; // safe-zone padding
  const box = size - pad * 2;

  const inside = (x, y) => {
    if (!maskable) {
      // rounded-rect coverage
      const min = r, maxX = size - r, maxY = size - r;
      if (x < min && y < min) return dist2(x - min, y - min) <= r * r;
      if (x > maxX && y < min) return dist2(x - maxX, y - min) <= r * r;
      if (x < min && y > maxY) return dist2(x - min, y - maxY) <= r * r;
      if (x > maxX && y > maxY) return dist2(x - maxX, y - maxY) <= r * r;
    }
    return true;
  };
  const dist2 = (dx, dy) => dx * dx + dy * dy;

  const bagX = pad, bagY = pad + box * 0.16, bagW = box, bagH = box * 0.7;
  const bagR = box * 0.09;
  const handleR = box * 0.21;
  const handleCX = size / 2, handleCY = bagY + box * 0.02;
  const handleStroke = box * 0.055;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      if (!inside(x, y)) continue; // transparent outside

      // diagonal gradient
      const t = (x + y) / (2 * size);
      let cr = A[0] + (B[0] - A[0]) * t;
      let cg = A[1] + (B[1] - A[1]) * t;
      let cb = A[2] + (B[2] - A[2]) * t;
      let alpha = 255;

      // white glyph with 1px-ish AA edges
      const white = (a) => { cr += (255 - cr) * a; cg += (255 - cg) * a; cb += (255 - cb) * a; };

      // bag body (rounded rect), slightly softer bottom
      const inBody = x >= bagX && x <= bagX + bagW && y >= bagY && y <= bagY + bagH;
      if (inBody) {
        const dx = Math.min(x - bagX, bagX + bagW - x);
        const dy = Math.min(y - bagY, bagY + bagH - y);
        const d = Math.min(dx, dy);
        if (d < bagR) {
          // corner check
          const cx = x < bagX + bagR ? bagX + bagR : bagX + bagW - bagR;
          const cy = y < bagY + bagR ? bagY + bagR : bagY + bagH - bagR;
          const dist = Math.sqrt(dist2(x - cx, y - cy));
          if (dist > bagR) {
            if (dx < bagR && dy < bagR) alpha = 0;
            else white(Math.max(0, Math.min(1, bagR - dist + 0.5)));
          } else white(1);
        } else white(1);
      }

      // handle: ring above the bag, clipped to upper half
      const dh = Math.sqrt(dist2(x - handleCX, y - handleCY));
      const ringOuter = handleR + handleStroke / 2;
      const ringInner = handleR - handleStroke / 2;
      const inRing = dh <= ringOuter && dh >= ringInner && y <= handleCY + handleStroke * 0.2;
      if (inRing) {
        const aa = Math.min(ringOuter - dh, dh - ringInner);
        white(Math.max(0, Math.min(1, aa + 0.5)));
      }

      px[i] = cr; px[i + 1] = cg; px[i + 2] = cb; px[i + 3] = alpha;
    }
  }
  return encodePNG(px, size, size);
}

const targets = [
  ['icon-192.png', 192, {}],
  ['icon-512.png', 512, {}],
  ['maskable-192.png', 192, { maskable: true }],
  ['maskable-512.png', 512, { maskable: true }],
  ['apple-touch-icon.png', 180, {}],
  ['favicon-32.png', 32, {}],
  ['favicon-16.png', 16, {}],
];
for (const [name, size, opts] of targets) {
  writeFileSync(join(outDir, name), paintIcon(size, opts));
  console.log(`wrote ${name} (${size}x${size})`);
}
console.log('done');
