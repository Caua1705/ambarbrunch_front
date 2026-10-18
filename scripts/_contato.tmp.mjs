import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
const [dir, out, cols = 3, w = 300] = process.argv.slice(2);
const files = fs.readdirSync(dir).filter(f => /\.(webp|jpg|png)$/.test(f));
const tiles = await Promise.all(files.map(async f => {
  const img = await sharp(path.join(dir, f)).resize(+w, +w, { fit: 'contain', background: '#fff' }).toBuffer();
  const label = Buffer.from(`<svg width="${w}" height="20"><rect width="100%" height="20" fill="#000"/><text x="4" y="15" font-size="13" fill="#fff" font-family="Arial">${f}</text></svg>`);
  return sharp({ create: { width: +w, height: +w + 20, channels: 3, background: '#fff' } }).composite([{ input: img, top: 20, left: 0 }, { input: label, top: 0, left: 0 }]).png().toBuffer();
}));
const rows = Math.ceil(tiles.length / cols);
await sharp({ create: { width: cols * w, height: rows * (+w + 20), channels: 3, background: '#ccc' } })
  .composite(tiles.map((t, i) => ({ input: t, left: (i % cols) * w, top: Math.floor(i / cols) * (+w + 20) }))).png().toFile(out);
console.log(files.join('\n'));
