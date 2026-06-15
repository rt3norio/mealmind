// Rasterize scripts/logo.svg into the PWA PNG icons used by the manifest.
// Run with: node scripts/gen-icons.mjs
import { readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import sharp from 'sharp';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const svg = readFileSync(join(here, 'logo.svg'));

const targets = [
  { file: 'public/pwa-192x192.png', size: 192 },
  { file: 'public/pwa-512x512.png', size: 512 },
  { file: 'public/apple-touch-icon.png', size: 180 },
  { file: 'public/favicon-48.png', size: 48 },
];

for (const t of targets) {
  await sharp(svg).resize(t.size, t.size).png().toFile(join(root, t.file));
  console.log('wrote', t.file);
}

// Keep an SVG favicon too.
writeFileSync(join(root, 'public/favicon.svg'), svg);
copyFileSync(join(root, 'public/favicon-48.png'), join(root, 'public/favicon.png'));
console.log('done');
