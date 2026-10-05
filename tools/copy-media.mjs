#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, mkdirSync, copyFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = process.argv[2] && resolve(process.argv[2]);
if (!source || !existsSync(resolve(source, 'images'))) {
  throw new Error('Usage: node tools/copy-media.mjs <source-public-directory>');
}
function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = resolve(dir, entry.name);
    if (entry.isDirectory()) return ['.git', 'node_modules', 'codex-work', 'images', '.mintlify'].includes(entry.name) ? [] : walk(path);
    return /\.(mdx|jsx|json|css)$/.test(entry.name) && !path.includes(`${root}/migration/`) ? [path] : [];
  });
}
const paths = new Set();
for (const file of walk(root)) {
  for (const match of readFileSync(file, 'utf8').matchAll(/\/images\/[A-Za-z0-9_./-]+\.(?:png|svg|gif|jpe?g|webp)/g)) paths.add(match[0]);
}
const placeholders = new Set(['home', 'market', 'rule-editor', 'supply-preview', 'auction-confirm', 'wallet']
  .map(name => `/images/kitemarket/screenshot-${name}.png`));
const assets = [];
for (const path of [...paths].sort()) {
  const input = resolve(source, `.${path}`);
  if (!input.startsWith(source) || !existsSync(input)) {
    if (placeholders.has(path)) continue;
    throw new Error(`Referenced media missing: ${path}`);
  }
  const output = resolve(root, `.${path}`);
  mkdirSync(dirname(output), { recursive: true });
  copyFileSync(input, output);
  const bytes = readFileSync(output);
  assets.push({ path, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
}
mkdirSync(resolve(root, 'migration'), { recursive: true });
writeFileSync(resolve(root, 'migration/media.json'), JSON.stringify({ schema: 1, assets, placeholders: [...placeholders] }, null, 2) + '\n');
console.log(`Copied ${assets.length} referenced media files without modifying originals (${assets.reduce((sum, a) => sum + a.bytes, 0)} bytes).`);
