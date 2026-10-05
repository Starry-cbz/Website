#!/usr/bin/env node
/**
 * Convert the paired VitePress documentation into Mintlify MDX.
 *
 * Usage: node tools/migrate-content.mjs --source /path/to/vitepress/pages --write
 * Without --write, validate the conversion and print its summary.
 * Landing and download pages are maintained separately and are never overwritten.
 */
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve, relative, join, posix } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const sourceArg = args.indexOf('--source');
assert.ok(sourceArg !== -1 && args[sourceArg + 1], 'Pass --source pointing to the VitePress pages directory.');
const sourceRoot = resolve(args[sourceArg + 1]);
const write = args.includes('--write');
const onlyArg = args.indexOf('--only');
const onlySources = onlyArg === -1 ? null : new Set(args[onlyArg + 1]?.split(','));
const commitArg = args.indexOf('--source-commit');
const sourceCommit = commitArg === -1 ? null : args[commitArg + 1];
assert.ok(existsSync(join(sourceRoot, '.vitepress/config.mts')), 'The source must be a VitePress pages directory.');

const { createMarkdownRenderer } = await import(
  pathToFileURL(resolve(sourceRoot, '../node_modules/vitepress/dist/node/index.js')).href
);
const markdown = await createMarkdownRenderer(sourceRoot);

function walk(folder) {
  return readdirSync(folder, { withFileTypes: true })
    .filter(entry => !entry.name.startsWith('.'))
    .flatMap(entry => {
      const full = join(folder, entry.name);
      if (entry.isDirectory()) return ['public', 'node_modules'].includes(entry.name) ? [] : walk(full);
      return entry.name.endsWith('.md') ? [relative(sourceRoot, full).replaceAll('\\', '/')] : [];
    });
}

function parseSource(sourceFile) {
  const raw = readFileSync(join(sourceRoot, sourceFile), 'utf8').replaceAll('\r\n', '\n');
  const match = raw.match(/^---\n([\s\S]*?)\n---(?:\n|$)/);
  return { raw, metadata: match?.[1] ?? '', body: match ? raw.slice(match[0].length) : raw };
}

function metadataValue(metadata, key) {
  const value = metadata.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'))?.[1];
  if (!value) return undefined;
  if (value.startsWith('"')) return JSON.parse(value);
  if (value.startsWith("'")) return value.slice(1, -1).replaceAll("''", "'");
  return value;
}

function pageTarget(sourceFile) {
  const locale = sourceFile.startsWith('en/') ? 'en' : 'zh';
  const local = sourceFile.replace(/^en\//, '');
  if (local === 'index.md') return { locale, target: locale === 'en' ? '/en' : '/', file: locale === 'en' ? 'en.mdx' : 'index.mdx' };
  let target = local.replace(/^docs\//, '').replace(/^verifymc/, 'archive/verifymc').replace(/\.md$/, '').replace(/\/index$/, '');
  if (locale === 'en') target = `en/${target}`;
  return { locale, target: `/${target}`, file: `${target}.mdx` };
}

const sources = walk(sourceRoot).sort();
assert.equal(sources.length, 84, 'Expected the agreed 84 source routes.');
const routes = sources.map(source => {
  const parsed = parseSource(source);
  const mapped = pageTarget(source);
  const oldPath = source === 'index.md' ? '/' : source === 'en/index.md' ? '/en/' :
    `/${source.replace(/index\.md$/, '').replace(/\.md$/, '')}`;
  const oldPaths = new Set([oldPath]);
  if (source.endsWith('/index.md') || source === 'index.md') {
    oldPaths.add(oldPath.replace(/\/$/, '') || '/');
    oldPaths.add(`/${source.replace(/\.md$/, '')}`);
    oldPaths.add(`/${source.replace(/\.md$/, '.html')}`);
  } else {
    oldPaths.add(`${oldPath}/`);
    oldPaths.add(`${oldPath}.html`);
  }
  const kind = /^layout: home$/m.test(parsed.metadata) ? 'landing' :
    posix.basename(source) === 'download.md' ? 'download' : 'document';
  return { source, oldPath, oldPaths: [...oldPaths], ...mapped, kind };
});
const routeBySource = new Map(routes.map(route => [route.source, route]));
const routeByTarget = new Map(routes.map(route => [route.target, route]));
assert.equal(new Set(routes.map(route => route.file)).size, routes.length, 'Route destinations must be unique.');

function rewriteUrl(url, sourceFile) {
  if (/^(?:https?:\/\/)?(?:www\.)?kitemc\.com\//i.test(url)) {
    url = new URL(url.startsWith('http') ? url : `https://${url}`).pathname +
      new URL(url.startsWith('http') ? url : `https://${url}`).search +
      new URL(url.startsWith('http') ? url : `https://${url}`).hash;
  }
  if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(url) || url.startsWith('#')) return url;
  const match = url.match(/^([^?#]*)([?#].*)?$/);
  const pathname = match?.[1] ?? url;
  const suffix = match?.[2] ?? '';
  if (pathname.startsWith('/images/')) return url;
  if (routeByTarget.has(pathname)) return url;
  const absolute = pathname.startsWith('/') ? pathname.slice(1) : posix.normalize(posix.join(posix.dirname(sourceFile), pathname));
  const stem = absolute.replace(/\.html$/, '');
  const candidates = [absolute, `${stem}.md`, `${stem.replace(/\/$/, '')}/index.md`];
  const target = candidates.map(candidate => routeBySource.get(candidate)).find(Boolean);
  assert.ok(target, `Unresolved source URL in ${sourceFile}: ${url}`);
  // English source pages sometimes link to the default /docs route by mistake.
  // Prefer its translation while preserving explicit /en and cross-site links.
  const localized = sourceFile.startsWith('en/') && pathname.startsWith('/docs/') ?
    routeBySource.get(`en/${target.source}`) ?? target : target;
  return `${localized.target}${suffix}`;
}

function decodeHtml(text) {
  return text.replaceAll('&amp;', '&').replaceAll('&quot;', '"').replaceAll('&#39;', "'")
    .replaceAll('&lt;', '<').replaceAll('&gt;', '>');
}

function plainTitle(text) {
  return decodeHtml(text.replace(/<Badge\b[^>]*\/>/g, '').replace(/<[^>]*>/g, '').replace(/[*`]/g, '').trim());
}

function attribute(value) {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function props(tag) {
  return Object.fromEntries([...tag.matchAll(/([\w:-]+)="([^"]*)"/g)].map(match => [match[1], match[2]]));
}

const iconNames = {
  'cog': 'settings', 'color-swatch': 'palette', 'document-text': 'file-text',
  'lightning-bolt': 'zap', 'question-mark-circle': 'circle-help', 'cart': 'shopping-cart',
  'chat': 'messages-square', 'register': 'user-plus', 'external': 'external-link', 'cube': 'box',
};
function card(tag, sourceFile) {
  const p = props(tag);
  assert.ok(p.title || p.text, `Card needs a title in ${sourceFile}: ${tag}`);
  const title = p.title ?? p.text;
  const href = p.href ? ` href="${attribute(rewriteUrl(p.href, sourceFile))}"` : '';
  const icon = p.icon ? ` icon="${attribute(iconNames[p.icon] ?? p.icon)}"` : '';
  if (!p.description) return `<Card title="${attribute(title)}"${icon}${href} />`;
  return `<Card title="${attribute(title)}"${icon}${href}>\n  ${p.description}\n</Card>`;
}

function protectFences(text) {
  const blocks = [];
  const protectedText = text.replace(/^([ \t]*)(`{3,}|~{3,})([^\n]*)\n([\s\S]*?)^\1\2[ \t]*(?=\n|$)/gm, full => {
    const token = `KITEMCMIGRATIONCODEBLOCK${blocks.length}END`;
    blocks.push(full);
    return token;
  });
  return { text: protectedText, restore: value => value.replace(/KITEMCMIGRATIONCODEBLOCK(\d+)END/g, (_, index) => blocks[Number(index)]) };
}

function convertGallery(text) {
  text = text.replace(/<div style="display: grid;[^"]*">\s*((?:<div>\s*<img[\s\S]*?<\/div>\s*)+)<\/div>/g, (_, contents) => {
    const figures = [...contents.matchAll(/<div>\s*<img\s+([^>]*?)\/?>\s*<p[^>]*>([\s\S]*?)<\/p>\s*<\/div>/g)];
    assert.ok(figures.length > 0, 'An image gallery must contain figures.');
    return `<Columns cols={2}>\n${figures.map(([, attributes, caption]) => {
      const p = props(attributes);
      return `  <Frame caption="${attribute(plainTitle(caption))}">\n    <img src="${attribute(p.src)}" alt="${attribute(p.alt ?? plainTitle(caption))}" />\n  </Frame>`;
    }).join('\n')}\n</Columns>`;
  });
  return text.replace(/<div style="[^"]*">\s*<img\s+([^>]*?)\/?>\s*<p[^>]*>([\s\S]*?)<\/p>\s*<\/div>/g, (_, attributes, caption) => {
    const p = props(attributes);
    return `<Frame caption="${attribute(plainTitle(caption))}">\n  <img src="${attribute(p.src)}" alt="${attribute(p.alt ?? plainTitle(caption))}" />\n</Frame>`;
  });
}

function convertComponents(text, sourceFile) {
  text = convertGallery(text);
  text = text.replace(/<Badge\b([^>]*?)\/>/g, (_, attributes) => props(attributes).text ?? '');
  text = text.replace(/<LinkCard\b[^>]*\/>/g, tag => card(tag, sourceFile));
  text = text.replace(/<FeatureBox\b[^>]*\/>/g, tag => card(tag, sourceFile));
  text = text.replace(/<ActionButton\b[^>]*\/>/g, tag => card(tag, sourceFile));
  text = text.replace(/<(?:LinkGrid|FeatureGrid)\b[^>]*>/g, tag => `<Columns cols={${Number(props(tag)[':cols'] ?? 2)}}>`)
    .replace(/<\/(?:LinkGrid|FeatureGrid)>/g, '</Columns>')
    .replace(/<ButtonGroup>/g, '<Columns cols={2}>').replace(/<\/ButtonGroup>/g, '</Columns>');
  text = text.replace(/<InlineLink\b([^>]*?)>([\s\S]*?)<\/InlineLink>/g, (_, attributes, label) => {
    const p = props(attributes);
    return `[${label.trim()}](${rewriteUrl(p.href, sourceFile)})`;
  });
  text = text.replace(/<InlineLink\b([^>]*?)\/>/g, (_, attributes) => {
    const p = props(attributes);
    const href = rewriteUrl(p.href, sourceFile);
    return `[${sourceFile.startsWith('en/') ? 'Related documentation' : '相关文档'}](${href})`;
  });
  text = text.replace(/<ScreenshotPlaceholder\b[^>]*\/>/g, tag => {
    const p = props(tag);
    return `<ScreenshotPlaceholder image="${attribute(p.src)}" title="${attribute(p.caption)}" description="${attribute(p.description)}" lang="${sourceFile.startsWith('en/') ? 'en' : 'zh'}" />`;
  });
  return text;
}

function convertContainers(text) {
  const stack = [];
  const names = { tip: 'Tip', info: 'Info', warning: 'Warning', danger: 'Warning', 'code-group': 'CodeGroup' };
  const converted = text.split('\n').map(line => {
    const opening = line.match(/^(\s*):::+\s*(tip|info|warning|danger|code-group)(?:\s+(.*))?$/);
    if (opening) {
      const tag = names[opening[2]];
      stack.push(tag);
      const title = opening[3]?.trim();
      return `${opening[1]}<${tag}>\n${title ? `\n**${title}**\n` : ''}`;
    }
    const closing = line.match(/^\s*:::+\s*$/);
    if (closing) {
      assert.ok(stack.length, 'A VitePress container closer must match an opener.');
      return `\n</${stack.pop()}>`;
    }
    return line;
  }).join('\n');
  assert.equal(stack.length, 0, 'VitePress containers must be balanced.');
  return converted;
}

function escapeMdxProse(text) {
  // Code spans and JSX tags retain their semantics; prose braces are literal text.
  return text.split(/(`+[^`\n]*`+|<[^>]*>|\{#[^}]+\})/g).map((part, index) =>
    index % 2 ? part : part.replace(/(?<!\\)[{}]/g, '\\$&')
  ).join('');
}

function updateLinks(text, sourceFile) {
  text = text.replace(/(?<!!)\[([^\]\n]*)\]\(([^)\s]+)\)/g, (_, label, href) => `[${label}](${rewriteUrl(href, sourceFile)})`);
  text = text.replace(/\bhref="([^"]+)"/g, (_, href) => `href="${attribute(rewriteUrl(decodeHtml(href), sourceFile))}"`);
  return text;
}

const anchorPages = [];
const outputs = [];
for (const route of routes) {
  const { metadata, body } = parseSource(route.source);
  const tokens = markdown.parse(body, { relativePath: route.source });
  const headings = [];
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];
    if (token.type !== 'heading_open') continue;
    headings.push({
      level: Number(token.tag.slice(1)),
      line: token.map[0] + 1,
      title: plainTitle(tokens[index + 1]?.content ?? ''),
      id: token.attrGet('id'),
    });
  }
  const builtFile = resolve(sourceRoot, '../dist', route.source.replace(/\.md$/, '.html'));
  if (existsSync(builtFile)) {
    const html = readFileSync(builtFile, 'utf8');
    for (const heading of headings) {
      assert.ok(html.includes(`id="${attribute(heading.id)}"`), `Rendered VitePress anchor differs for ${route.source}#${heading.id}`);
    }
  }
  anchorPages.push({ source: route.source, target: route.target, file: route.file, anchors: headings });
  if (route.kind !== 'document') continue;

  const lines = body.split('\n');
  const firstHeading = headings.find(heading => heading.level === 1);
  const title = metadataValue(metadata, 'title') ?? firstHeading?.title;
  assert.ok(title, `A document must have a title: ${route.source}`);
  for (const heading of headings) {
    if (heading === firstHeading) {
      lines[heading.line - 1] = `<span id="${attribute(heading.id)}" />`;
    } else {
      lines[heading.line - 1] += ` {#${heading.id}}`;
    }
  }
  let text = lines.join('\n');
  const fences = protectFences(text);
  text = fences.text;
  text = text.replace(/<script\b[^>]*>[\s\S]*?<\/script>\s*/g, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>\s*/g, '')
    .replace(/<!--[\s\S]*?-->/g, '');
  text = convertContainers(convertComponents(text, route.source));
  text = updateLinks(text, route.source);
  text = escapeMdxProse(text);
  assert.ok(!/<(?:LinkCard|LinkGrid|FeatureBox|FeatureGrid|InlineLink|ActionButton|ButtonGroup|Badge)\b/.test(text), `A Vue component remains in ${route.source}`);
  assert.ok(!/^:::/m.test(text), `A VitePress container remains in ${route.source}`);
  assert.ok(!/\bstyle=["']/.test(text), `Convert React-incompatible HTML style strings in ${route.source}.`);
  const imports = text.includes('<ScreenshotPlaceholder') ? '\nimport { ScreenshotPlaceholder } from "/snippets/screenshot-placeholder.jsx";\n' : '';
  const description = metadataValue(metadata, 'description');
  const fm = [
    '---',
    `title: ${JSON.stringify(title)}`,
    ...(description ? [`description: ${JSON.stringify(description)}`] : []),
    `canonical: ${JSON.stringify(`https://www.kitemc.com${route.target}`)}`,
    '---',
    '',
  ].join('\n');
  const discontinued = route.source.includes('/verifymc/') ?
    route.locale === 'en' ?
      '\n<Warning>\nVerifyMC is discontinued. These historical documents remain available for existing users and do not imply active maintenance or current compatibility.\n</Warning>\n' :
      '\n<Warning>\nVerifyMC 已停止维护。本页保留供已有用户查阅历史配置与使用方法，不表示当前仍在维护或已验证新版本兼容性。\n</Warning>\n' : '';
  const content = `${fm}${imports}${discontinued}\n${fences.restore(text).trim()}\n`;
  outputs.push({ route, content });
}

assert.equal(outputs.length, 70, 'Landing and download pages must remain outside this converter.');
const routeManifest = { schema: 1, sourceCommit, pages: routes };
const anchorManifest = { schema: 1, sourceCommit, pages: anchorPages };
if (write) {
  const selected = outputs.filter(({ route }) => !onlySources || onlySources.has(route.source));
  if (onlySources) assert.equal(selected.length, onlySources.size, 'Every --only value must name an ordinary source page.');
  for (const { route, content } of selected) {
    const target = resolve(repoRoot, route.file);
    assert.ok(target.startsWith(`${repoRoot}\\`) || target.startsWith(`${repoRoot}/`), 'Output must stay in the repository.');
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, content, 'utf8');
  }
  if (!onlySources) {
    mkdirSync(join(repoRoot, 'migration'), { recursive: true });
    writeFileSync(join(repoRoot, 'migration/routes.json'), `${JSON.stringify(routeManifest, null, 2)}\n`, 'utf8');
    writeFileSync(join(repoRoot, 'migration/anchors.json'), `${JSON.stringify(anchorManifest, null, 2)}\n`, 'utf8');
  }
}
console.log(JSON.stringify({
  write,
  sourcePages: routes.length,
  convertedDocuments: outputs.length,
  landingPages: routes.filter(route => route.kind === 'landing').length,
  downloadPages: routes.filter(route => route.kind === 'download').length,
  preservedAnchors: anchorPages.reduce((sum, page) => sum + page.anchors.length, 0),
  pairedLocales: routes.filter(route => route.locale === 'zh').length === routes.filter(route => route.locale === 'en').length,
}, null, 2));
