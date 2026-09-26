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
//   node build.mjs          write index.html
//   node build.mjs --check  exit with an error if index.html is not the current build
//
// No dependencies. Nothing is minified or rewritten: the output is the source files
// joined in the order the template lists them.

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const SRC = join(ROOT, 'src');
const TEMPLATE = join(SRC, 'index.html');
const OUTPUT = join(ROOT, 'index.html');
const INCLUDE = /^[ \t]*<!-- @include (\S+)(?: indent=(\d+))? -->[ \t]*$/;
// Every file in these folders must be included exactly once.
const SOURCE_DIRS = ['styles', 'markup', 'scripts'];

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
    const indent = ' '.repeat(Number(match[2] || 0));
    if (indent) content = content.split('\n').map((l) => (l ? indent + l : l)).join('\n');
    // The include line and its newline are replaced by the file, which brings its own newline.
    out.push(content.slice(0, -1));
  });

  const unused = SOURCE_DIRS.flatMap((dir) => listFiles(join(SRC, dir))).filter((rel) => !used.has(rel));
  if (unused.length) fail(`not included by src/index.html: ${unused.join(', ')}`);

  return out.join('\n');
}

const html = build();

if (process.argv.includes('--check')) {
  const current = existsSync(OUTPUT) ? readFileSync(OUTPUT, 'utf8') : '';
  if (current !== html) {
    fail('index.html is out of date. Run "node build.mjs" and commit the result.');
  }
  console.log('build: index.html matches the source files.');
} else {
  writeFileSync(OUTPUT, html);
  console.log(`build: wrote index.html (${Buffer.byteLength(html)} bytes).`);
}
