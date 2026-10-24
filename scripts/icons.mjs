// Builds the PNG icons from icons/icon.svg. Needs rsvg-convert (librsvg) on the PATH.
// Run it after changing the SVG: npm run icons

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const svg = readFileSync('icons/icon.svg', 'utf8');
// Full-bleed square with the art shrunk into the 80% safe zone, for maskable and iOS icons.
const square = svg
  .replace('rx="112"', 'rx="0"')
  .replace('<g id="art">', '<g id="art" transform="translate(51.2 51.2) scale(0.8)">');

const dir = mkdtempSync(join(tmpdir(), 'poprocks-icons-'));
const squarePath = join(dir, 'square.svg');
writeFileSync(squarePath, square);

const outputs = [
  ['icons/icon.svg', 192, 'icons/icon-192.png'],
  ['icons/icon.svg', 512, 'icons/icon-512.png'],
  [squarePath, 512, 'icons/maskable-512.png'],
  [squarePath, 180, 'icons/apple-touch-icon.png'],
];

outputs.forEach(([src, size, out]) => {
  execFileSync('rsvg-convert', ['-w', String(size), '-h', String(size), '-o', out, src]);
});
rmSync(dir, { recursive: true });
console.log(`Wrote ${outputs.length} icons`);
