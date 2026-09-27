#!/usr/bin/env node
// Team Pulse build.
//
// Reads the page template at src/index.html and replaces every line of the form
//
//   <!-- @include path/to/file -->
//   <!-- @include path/to/file indent=4 -->
//
// with the exact contents of that file (path relative to src/). With indent=N,
// every line that is not empty gets N spaces in front, so style files can be
// written without the indentation they have inside the page. The result is the
// single self-contained index.html at the repository root, which GitHub Pages serves.
//
// In style files, url() references to local files (for example the fonts in
// src/fonts) are embedded as base64 data URLs, so the page never loads anything.
// The build stops if the finished page would load anything from the network,
// either through a tag or url() or through a script call such as fetch(),
// XMLHttpRequest, WebSocket, EventSource, sendBeacon() or a dynamic import().
//
//   node build.mjs              write index.html
//   node build.mjs --check      exit with an error if index.html is not the current build
//   node build.mjs --out FILE   write the build to FILE instead (for previews)
//
// No dependencies. Nothing is minified or rewritten: apart from the embedded
// files, the output is the source files joined in the order the template lists them.

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve, sep, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const SRC = join(ROOT, 'src');
const TEMPLATE = join(SRC, 'index.html');
const OUTPUT = join(ROOT, 'index.html');
const INCLUDE = /^[ \t]*<!-- @include (\S+)(?: indent=(\d+))? -->[ \t]*$/;
// Every file in these folders must be included exactly once.
const SOURCE_DIRS = ['styles', 'markup', 'scripts'];
const EMBED_TYPES = { '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.png': 'image/png' };
const CSS_URL = /url\(\s*(['"]?)([^'")]+)\1\s*\)/g;
// Anything in the finished page that would make the browser fetch from the network.
const NETWORK_LOAD = /(?:url\(\s*['"]?|@import\s+(?:url\(\s*)?['"]?|<(?:link|script|img|iframe|source|video|audio|embed|object)\b[^>]*?\s(?:href|src|data)\s*=\s*['"]?)(?:https?:)?\/\//i;
// Script calls that can reach the network at runtime. The app never needs any of them.
const NETWORK_API = /\b(?:fetch|sendBeacon|import)\s*\(|\b(?:XMLHttpRequest|WebSocket|EventSource)\b/;

function fail(message) {
  console.error(`build: ${message}`);
  process.exit(1);
}

function listFiles(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? listFiles(path) : [relative(SRC, path).split(sep).join('/')];
  });
}

// Replaces url(relative/path) in a style file with the file itself as a data URL.
function embedCssUrls(css, rel) {
  const baseDir = dirname(join(SRC, rel));
  return css.replace(CSS_URL, (whole, quote, target) => {
    if (/^(data:|#)/i.test(target)) return whole;
    if (/^([a-z]+:)?\/\//i.test(target)) fail(`${rel} loads ${target} from the network. Embed the file instead.`);
    const file = resolve(baseDir, target);
    if (relative(SRC, file).startsWith('..')) fail(`${rel}: ${target} is outside src/`);
    if (!existsSync(file)) fail(`${rel}: ${target} does not exist`);
    const type = EMBED_TYPES[extname(file).toLowerCase()];
    if (!type) fail(`${rel}: cannot embed ${target} (unknown file type)`);
    return `url("data:${type};base64,${readFileSync(file).toString('base64')}")`;
  });
}

function build() {
  const template = readFileSync(TEMPLATE, 'utf8');
  if (template.includes('\r')) fail('src/index.html has Windows line endings. Save it with LF line endings.');
  const lines = template.split('\n');
  const used = new Set();
  const out = [];

  lines.forEach((line, index) => {
    const match = INCLUDE.exec(line);
    if (!match) {
      if (line.includes('@include')) fail(`src/index.html line ${index + 1} is not a valid include line: ${line.trim()}`);
      out.push(line);
      return;
    }
    const rel = match[1];
    const file = join(SRC, rel);
    if (relative(SRC, file).startsWith('..')) fail(`src/index.html line ${index + 1}: ${rel} is outside src/`);
    if (!existsSync(file)) fail(`src/index.html line ${index + 1}: ${rel} does not exist`);
    if (used.has(rel)) fail(`src/index.html line ${index + 1}: ${rel} is included twice`);
    used.add(rel);
    let content = readFileSync(file, 'utf8');
    if (!content.endsWith('\n')) fail(`${rel} must end with a newline`);
    if (content.includes('\r')) fail(`${rel} has Windows line endings. Save it with LF line endings.`);
    if (content.includes('<!-- @include ')) fail(`${rel} contains an include line. Only src/index.html may include files`);
    if (rel.endsWith('.css')) content = embedCssUrls(content, rel);
    const indent = ' '.repeat(Number(match[2] || 0));
    if (indent) content = content.split('\n').map((l) => (l ? indent + l : l)).join('\n');
    // The include line and its newline are replaced by the file, which brings its own newline.
    out.push(content.slice(0, -1));
  });

  const unused = SOURCE_DIRS.flatMap((dir) => listFiles(join(SRC, dir))).filter((rel) => !used.has(rel));
  if (unused.length) fail(`not included by src/index.html: ${unused.join(', ')}`);

  const html = out.join('\n');
  const load = NETWORK_LOAD.exec(html);
  if (load) fail(`the page would load from the network: ${html.slice(load.index, load.index + 80)}`);
  const api = NETWORK_API.exec(html);
  if (api) {
    const line = html.slice(0, api.index).split('\n').length;
    fail(`the page uses ${api[0].replace(/\s*\($/, '(')} on line ${line}, which could reach the network. Team Pulse must not load anything at runtime.`);
  }
  return html;
}

const html = build();

if (process.argv.includes('--check')) {
  const current = existsSync(OUTPUT) ? readFileSync(OUTPUT, 'utf8') : '';
  if (current !== html) {
    fail('index.html is out of date. Run "node build.mjs" and commit the result.');
  }
  console.log('build: index.html matches the source files.');
} else {
  const outIndex = process.argv.indexOf('--out');
  const target = outIndex > -1 ? resolve(process.argv[outIndex + 1] || fail('--out needs a file name')) : OUTPUT;
  writeFileSync(target, html);
  console.log(`build: wrote ${relative(ROOT, target) || target} (${Buffer.byteLength(html)} bytes).`);
}
