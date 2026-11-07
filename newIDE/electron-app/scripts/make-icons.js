#!/usr/bin/env node
// Generates the Webvelop icons (PNG and ICO), without any dependency:
// a rounded square with a gradient and a white "W".
// Run: node scripts/make-icons.js
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const crcTable = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});
const crc32 = buffer => {
  let crc = -1;
  for (let i = 0; i < buffer.length; i++) crc = crcTable[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ -1) >>> 0;
};
const chunk = (type, data) => {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData));
  return Buffer.concat([length, typeAndData, crc]);
};

const encodePng = (size, pixels) => {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // RGBA
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    pixels.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
};

const distanceToSegment = (px, py, ax, ay, bx, by) => {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
};

// The logo, on a 64x64 grid (same as WebvelopLogoIcon in the editor).
const W_POINTS = [[14, 20], [22, 46], [32, 26], [42, 46], [50, 20]];
const from = [0x63, 0x66, 0xf1];
const to = [0x06, 0xb6, 0xd4];

const renderLogo = size => {
  const pixels = Buffer.alloc(size * size * 4);
  const samples = 4; // supersampling for antialiasing
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < samples; sy++) {
        for (let sx = 0; sx < samples; sx++) {
          const u = ((x + (sx + 0.5) / samples) / size) * 64;
          const v = ((y + (sy + 0.5) / samples) / size) * 64;
          // Rounded square from 2 to 62 with a radius of 14.
          const cx = Math.max(16, Math.min(48, u));
          const cy = Math.max(16, Math.min(48, v));
          if (Math.hypot(u - cx, v - cy) > 14) continue;
          let color;
          let minDistance = Infinity;
          for (let i = 0; i < W_POINTS.length - 1; i++) {
            const [ax, ay] = W_POINTS[i];
            const [bx, by] = W_POINTS[i + 1];
            minDistance = Math.min(minDistance, distanceToSegment(u, v, ax, ay, bx, by));
          }
          if (minDistance <= 3) color = [255, 255, 255];
          else {
            const t = Math.max(0, Math.min(1, (u + v) / 128));
            color = from.map((c, i) => Math.round(c + (to[i] - c) * t));
          }
          r += color[0];
          g += color[1];
          b += color[2];
          a += 255;
        }
      }
      const count = samples * samples;
      const offset = (y * size + x) * 4;
      const alpha = a / count;
      pixels[offset] = alpha ? Math.round((r / count) * (255 / alpha)) : 0;
      pixels[offset + 1] = alpha ? Math.round((g / count) * (255 / alpha)) : 0;
      pixels[offset + 2] = alpha ? Math.round((b / count) * (255 / alpha)) : 0;
      pixels[offset + 3] = Math.round(alpha);
    }
  }
  return encodePng(size, pixels);
};

const encodeIco = pngs => {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);
  let offset = 6 + pngs.length * 16;
  const entries = pngs.map(({ size, data }) => {
    const entry = Buffer.alloc(16);
    entry[0] = size >= 256 ? 0 : size;
    entry[1] = size >= 256 ? 0 : size;
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(data.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += data.length;
    return entry;
  });
  return Buffer.concat([header, ...entries, ...pngs.map(p => p.data)]);
};

const cache = {};
const png = size => (cache[size] = cache[size] || renderLogo(size));
const write = (file, content) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
  console.log('✅ ' + path.relative(path.join(__dirname, '../..'), file));
};

const electronApp = path.join(__dirname, '..');
const editorPublic = path.join(__dirname, '../../app/public');
const ico = encodeIco([16, 24, 32, 48, 64, 128, 256].map(size => ({ size, data: png(size) })));

write(path.join(electronApp, 'app/icon.png'), png(512));
write(path.join(electronApp, 'build/icon.png'), png(1024));
write(path.join(electronApp, 'build/icon.ico'), ico);
write(path.join(editorPublic, 'favicon.ico'), ico);
write(path.join(editorPublic, 'favicon-16x16.png'), png(16));
write(path.join(editorPublic, 'favicon-32x32.png'), png(32));
write(path.join(editorPublic, 'apple-touch-icon.png'), png(180));
write(path.join(editorPublic, 'android-chrome-192x192.png'), png(192));
write(path.join(editorPublic, 'android-chrome-512x512.png'), png(512));
