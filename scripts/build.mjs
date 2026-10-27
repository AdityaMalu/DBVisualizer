#!/usr/bin/env node
// Bundles src/ into one self-contained dist/index.html (styles and scripts inlined),
// and copies the SQLite engine (sql.js, WebAssembly inlined) to dist/vendor/, loaded only when a query runs.
// Usage: node scripts/build.mjs [--watch]
import { readFileSync, writeFileSync, mkdirSync, readdirSync, copyFileSync, existsSync, watch } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');
const OUT = join(ROOT, 'dist', 'index.html');
export const SQLJS = join(ROOT, 'node_modules', 'sql.js', 'dist', 'sql-wasm-inline.js');

// Cascade order matters: later files override earlier ones.
const STYLES = ['tokens', 'layout', 'theory', 'stepper', 'study', 'quiz', 'responsive'].map(n => `styles/${n}.css`);

// Classic scripts share one global scope, so order matters:
// registry first, then content (which calls part()/topic()), then the engine, boot last.
const ENGINE = ['model', 'dom', 'diagrams', 'focus', 'sidebar', 'theory', 'quiz', 'sqlrun', 'study', 'stepper', 'main'].map(n => `engine/${n}.js`);

const byTopicNo = (a, b) => a.no.localeCompare(b.no, undefined, { numeric: true });

export function topicFiles() {
  const dir = join(SRC, 'content');
  return readdirSync(dir, { withFileTypes: true })
    .filter(d => d.isDirectory() && d.name.startsWith('part-'))
    .flatMap(d => readdirSync(join(dir, d.name))
      .filter(f => f.endsWith('.js'))
      .map(f => ({ no: f.slice(0, f.indexOf('-')), file: `content/${d.name}/${f}` })))
    .sort(byTopicNo)
    .map(x => x.file);
}

export function scriptOrder() {
  return ['engine/registry.js', 'content/parts.js', 'content/datasets.js', ...topicFiles(), ...ENGINE];
}

const read = rel => readFileSync(join(SRC, rel), 'utf8').replace(/\s*$/, '\n');

export function build() {
  const shell = read('index.html');
  for (const mark of ['<!-- @styles -->', '<!-- @scripts -->'])
    if (shell.split(mark).length !== 2) throw new Error(`src/index.html must contain ${mark} exactly once`);

  const css = STYLES.map(read).join('\n');
  const scripts = scriptOrder().map(rel => {
    const code = read(rel);
    if (/<\/script/i.test(code)) throw new Error(`${rel}: contains "</script", which would end the inline script early`);
    return `<script>\n/* src/${rel} */\n${code}</script>`;
  });

  const html = shell
    .replace('<!-- @styles -->', () => `<style>\n${css}</style>`)
    .replace('<!-- @scripts -->', () => scripts.join('\n'));
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, html);
  // files in public/ (e.g. the Search Console verification file) are served from the site root
  const PUB = join(ROOT, 'public');
  if (existsSync(PUB)) for (const f of readdirSync(PUB)) copyFileSync(join(PUB, f), join(ROOT, 'dist', f));
  if (!existsSync(SQLJS)) throw new Error('node_modules/sql.js is missing: run "npm ci" first');
  mkdirSync(join(ROOT, 'dist', 'vendor'), { recursive: true });
  copyFileSync(SQLJS, join(ROOT, 'dist', 'vendor', 'sql-wasm-inline.js'));
  return { out: relative(ROOT, OUT), bytes: html.length, scripts: scripts.length };
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const run = () => {
    try { const r = build(); console.log(`built ${r.out}: ${r.scripts} scripts, ${(r.bytes / 1024).toFixed(0)} KB`); }
    catch (e) { console.error(`build failed: ${e.message}`); if (!process.argv.includes('--watch')) process.exit(1); }
  };
  run();
  if (process.argv.includes('--watch')) {
    let t = null;
    watch(SRC, { recursive: true }, () => { clearTimeout(t); t = setTimeout(run, 100); });
    console.log('watching src/ for changes…');
  }
}
