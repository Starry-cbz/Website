#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const config = JSON.parse(readFileSync(resolve(root, 'docs.json'), 'utf8'));
const migrated = JSON.parse(readFileSync(resolve(root, 'migration/routes.json'), 'utf8')).pages;
const additions = JSON.parse(readFileSync(resolve(root, 'content-pages.json'), 'utf8'));
assert.equal(additions.schema, 1, 'Unsupported content page schema');
const routes = [...migrated, ...additions.pages];
const headings = JSON.parse(readFileSync(resolve(root, 'migration/anchors.json'), 'utf8')).pages;
assert.equal(migrated.length, 84, 'Every source page must be mapped');
assert.equal(new Set(routes.map(r => r.file)).size, routes.length, 'Page files must be unique');
assert.equal(new Set(routes.map(r => r.target)).size, routes.length, 'Canonical routes must be unique');
for (const page of additions.pages) {
  assert.ok(['zh', 'en'].includes(page.locale), `Invalid locale: ${page.file}`);
  assert.equal(page.kind, 'document', `Invalid content page kind: ${page.file}`);
  assert.equal(page.target, '/' + page.file.replace(/\.mdx$/, ''), `Route does not match file: ${page.file}`);
  assert.equal(page.locale === 'en', page.file.startsWith('en/'), `Locale does not match path: ${page.file}`);
}
const files = new Map(routes.map(r => [r.target.replace(/\/$/, '') || '/', r.file]));
const texts = new Map(routes.map(r => {
  const file = resolve(root, r.file);
  assert.ok(existsSync(file), `Missing ${r.file}`);
  return [r.file, readFileSync(file, 'utf8')];
}));
const pairs = new Set(routes.filter(r => r.locale !== 'en').map(r => r.target === '/' ? '/en' : `/en${r.target}`));
assert.equal(pairs.size * 2, routes.length, 'Every page must have one translation pair');
for (const path of pairs) assert.ok(files.has(path), `Missing English pair ${path}`);
function checkRegisteredPages(directory = '') {
  for (const entry of readdirSync(resolve(root, directory), { withFileTypes: true })) {
    if (entry.name.startsWith('.') || ['node_modules', 'codex-work', 'images', 'snippets', 'tools', 'migration'].includes(entry.name)) continue;
    const file = posix.join(directory, entry.name);
    if (entry.isDirectory()) checkRegisteredPages(file);
    else if (file.endsWith('.mdx') && file !== 'en/index.mdx') {
      assert.ok(texts.has(file), `Unregistered page: ${file}`);
    }
  }
}
checkRegisteredPages();
assert.equal(config.seo?.metatags?.canonical, 'https://www.kitemc.com');
assert.ok(config.navigation.languages?.length === 2);
assert.ok(config.navigation.languages[0].language.startsWith('zh'));
const redirects = new Map((config.redirects || []).map(r => [r.source, r.destination]));
assert.equal(redirects.size, config.redirects.length, 'Redirect sources must be unique');
// Mintlify treats a trailing /index as the containing page even when matching
// redirect sources. An explicit /index -> / therefore redirects / to itself.
function canonicalRoute(path) {
  return path.replace(/\/$/, '').replace(/\/index$/, '') || '/';
}
for (const [source, destination] of redirects) {
  assert.notEqual(canonicalRoute(source), canonicalRoute(destination), `Self redirect after Mintlify normalization: ${source}`);
}
const englishHomeAlias = readFileSync(resolve(root, 'en/index.mdx'), 'utf8');
assert.match(englishHomeAlias, /^url: "\/en"$/m, 'The legacy English index must redirect only its own page');
assert.match(englishHomeAlias, /^noindex: true$/m);
assert.match(englishHomeAlias, /^hidden: true$/m);
for (const route of routes) {
  const text = texts.get(route.file);
  const prose = text.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');
  if (route.kind === 'document') assert.ok(!/mode:\s*(custom|wide)/.test(text.split('---')[1]), `Unexpected document mode: ${route.file}`);
  assert.ok(!/:::\s|<script setup|<ActionButton|<LinkGrid|<ProductDownloadLayout|:show-|<template>/.test(prose), `Unconverted Vue: ${route.file}`);
  if (route.target.includes('/archive/verifymc')) assert.match(text, /停止维护|no longer maintained|discontinued/i);
  for (const old of route.oldPaths || []) {
    if (canonicalRoute(old) === route.target) continue;
    assert.equal(redirects.get(old), route.target, `Missing redirect: ${old}`);
  }
}
let anchorCount = 0;
for (const page of headings) {
  const text = texts.get(page.file);
  for (const { id } of page.anchors) {
    assert.ok(text.includes(`{#${id}}`) || text.includes(`id="${id}"`) || text.includes(`id='${id}'`), `Lost old anchor ${page.file}#${id}`);
    anchorCount++;
  }
}
function anchors(text) {
  return new Set([...text.matchAll(/\{#([^}]+)\}|id=["']([^"']+)["']/g)].map(m => m[1] || m[2]));
}
const permittedPlaceholder = /^\/images\/kitemarket\/screenshot-auction-confirm\.png$/;
let localLinks = 0;
for (const [file, body] of texts) {
  const text = body.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');
  for (const m of text.matchAll(/(?:href|src|image)=["']([^"']+)["']|\]\(([^)\s]+)(?:\s+["'][^)]*)?\)/g)) {
    const href = m[1] || m[2];
    if (/^(https?:|mailto:|data:)/.test(href)) continue;
    if (href.startsWith('/images/')) {
      assert.ok(existsSync(resolve(root, `.${href}`)) || permittedPlaceholder.test(href), `Missing media ${file}: ${href}`);
      continue;
    }
    const [path, fragment] = href.split('#');
    const from = '/' + file.replace(/\.mdx$/, '').replace(/\/?index$/, '');
    const target = path ? (path.startsWith('/') ? path : posix.resolve(posix.dirname(from), path)) : (from || '/');
    const normalized = target.replace(/\.(mdx?|html)$/, '').replace(/\/$/, '') || '/';
    const destination = redirects.get(normalized) || normalized;
    const targetFile = files.get(destination);
    assert.ok(targetFile, `Broken local link ${file}: ${href}`);
    if (fragment) assert.ok(anchors(texts.get(targetFile)).has(decodeURIComponent(fragment)), `Broken anchor ${file}: ${href}`);
    localLinks++;
  }
}
function checkNav(node) {
  if (typeof node === 'string') {
    if (/^https?:/.test(node)) return;
    const [page, fragment] = node.split('#');
    const file = `${page}.mdx`;
    assert.ok(texts.has(file), `Missing navigation page ${node}`);
    if (fragment) assert.ok(anchors(texts.get(file)).has(fragment), `Missing navigation anchor ${node}`);
  } else if (Array.isArray(node)) node.forEach(checkNav);
  else if (node && typeof node === 'object') {
    if (node.pages) checkNav(node.pages);
    if (node.groups) checkNav(node.groups);
    if (node.tabs) checkNav(node.tabs);
    if (node.languages) checkNav(node.languages);
  }
}
checkNav(config.navigation);
const media = JSON.parse(readFileSync(resolve(root, 'migration/media.json'), 'utf8')).assets;
for (const asset of media) {
  const bytes = readFileSync(resolve(root, `.${asset.path}`));
  assert.equal(bytes.length, asset.bytes, `Media size changed: ${asset.path}`);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), asset.sha256, `Media digest changed: ${asset.path}`);
}
for (const locale of ['', 'en/']) {
  const text = [...texts.entries()].filter(([file]) => locale ? file === 'en.mdx' || file.startsWith(locale) : file !== 'en.mdx' && !file.startsWith('en/')).map(([, text]) => text).join('\n');
  for (const name of ['home', 'market', 'rule-editor', 'supply-preview', 'auction-confirm', 'wallet', 'publish-terms', 'claims-entrance', 'claims', 'receipt']) {
    assert.ok(text.includes(`/images/kitemarket/screenshot-${name}.png`), `Missing ${locale} screenshot slot ${name}`);
  }
}
console.log(`Static checks passed: ${routes.length} bilingual pages, ${anchorCount} preserved heading IDs, ${redirects.size} redirects and ${localLinks} local links.`);
