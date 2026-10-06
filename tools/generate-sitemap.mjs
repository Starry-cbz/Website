#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pages = [
  ...JSON.parse(readFileSync(resolve(root, 'migration/routes.json'), 'utf8')).pages,
  ...JSON.parse(readFileSync(resolve(root, 'content-pages.json'), 'utf8')).pages,
];
const paths = new Set(pages.map(page => page.target));
assert.equal(paths.size, pages.length, 'Canonical routes must be unique');
const origin = 'https://www.kitemc.com';
const escapeXml = value => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const lines = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
];

for (const page of pages) {
  const chinese = page.locale === 'en' ? page.target.replace(/^\/en(?=\/|$)/, '') || '/' : page.target;
  const english = chinese === '/' ? '/en' : `/en${chinese}`;
  assert.ok(paths.has(chinese) && paths.has(english), `Missing translation pair for ${page.target}`);
  lines.push('  <url>', `    <loc>${escapeXml(origin + page.target)}</loc>`);
  for (const [language, path] of [['zh-CN', chinese], ['en', english], ['x-default', chinese]]) {
    lines.push(`    <xhtml:link rel="alternate" hreflang="${language}" href="${escapeXml(origin + path)}" />`);
  }
  lines.push('  </url>');
}
lines.push('</urlset>');
const content = lines.join('\n') + '\n';
const output = resolve(root, 'sitemap.xml');
if (process.argv.includes('--check')) {
  assert.ok(readFileSync(output, 'utf8').replace(/\r\n/g, '\n') === content,
    'Run node tools/generate-sitemap.mjs after changing the route map or content-pages.json');
  console.log(`Sitemap checks passed: ${pages.length} canonical URLs with reciprocal language links.`);
} else {
  writeFileSync(output, content);
  console.log(`Generated sitemap.xml: ${pages.length} canonical URLs with reciprocal language links.`);
}
