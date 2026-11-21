#!/usr/bin/env node
// Token contrast check (REDESIGN_V2 §2.4). Reads src/styles/tokens.css,
// resolves var() references per theme and fails (exit 1) if any listed pair
// drops below WCAG AA: 4.5:1 for text, 3:1 for large text / UI.
// Run: node scripts/check-contrast.mjs   (also runs in `pnpm build`)

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const css = readFileSync(join(root, 'src/styles/tokens.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

function block(selector) {
  const i = css.indexOf(selector + ' {');
  if (i < 0) throw new Error(`tokens.css: ${selector} block not found`);
  const body = css.slice(css.indexOf('{', i) + 1, css.indexOf('\n}', i));
  const out = {};
  for (const m of body.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].trim();
  return out;
}

const light = block(':root');
const dark = { ...light, ...block("[data-theme='dark']") };

function resolve(vars, name, seen = new Set()) {
  if (seen.has(name)) throw new Error(`cycle at --${name}`);
  seen.add(name);
  const v = vars[name];
  if (v == null) throw new Error(`--${name} is not defined`);
  const m = v.match(/^var\(--([\w-]+)\)$/);
  return m ? resolve(vars, m[1], seen) : v;
}

function parse(c) {
  c = c.trim().toLowerCase();
  let m = c.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/);
  if (m) {
    let h = m[1];
    if (h.length === 3) h = [...h].map((x) => x + x).join('');
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)).concat(1);
  }
  m = c.match(/^rgba?\(([^)]+)\)$/);
  if (m) {
    const p = m[1].split(',').map((x) => parseFloat(x));
    return [p[0], p[1], p[2], p[3] ?? 1];
  }
  throw new Error(`cannot parse colour "${c}"`);
}

const over = (fg, bg) => fg.slice(0, 3).map((v, i) => v * fg[3] + bg[i] * (1 - fg[3])).concat(1);
const lum = ([r, g, b]) =>
  [r, g, b]
    .map((v) => v / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
    .reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0);
function ratio(vars, fgName, bgName) {
  const bg = parse(resolve(vars, bgName));
  const fg = over(parse(resolve(vars, fgName)), bg);
  const [a, b] = [lum(fg), lum(bg)].sort((x, y) => y - x);
  return (a + 0.05) / (b + 0.05);
}

const TEXT = 4.5;
const LARGE = 3;

// [foreground, background, minimum]
const common = [
  ['text', 'bg-0', TEXT],
  ['text', 'surface', TEXT],
  ['text', 'surface-raised', TEXT],
  ['text-muted', 'bg-0', TEXT],
  ['text-muted', 'surface', TEXT],
  ['text-muted', 'surface-raised', TEXT],
  ['primary', 'bg-0', TEXT],
  ['primary', 'surface', TEXT],
  ['primary', 'surface-raised', TEXT],
  ['on-primary', 'primary', TEXT],
  ['gold', 'bg-0', TEXT],
  ['gold', 'surface', TEXT],
  ['on-gold', 'gold-fill', TEXT],
  ['green', 'bg-0', TEXT],
  ['green', 'surface', TEXT],
  ['on-green', 'green', TEXT],
  ['danger', 'bg-0', TEXT],
  ['danger', 'surface', TEXT],
  ['on-danger', 'danger', TEXT],
  ['warning', 'bg-0', TEXT],
  ['warning', 'surface', TEXT],
  ['on-accent', 'accent', TEXT],
  ['border-strong', 'surface', 1.4], // decorative hairline, informational only
];
const cats = ['food', 'cakes', 'beauty', 'hair', 'fashion', 'accessories', 'gadgets', 'groceries', 'home', 'tutors', 'other'];
for (const c of cats) {
  common.push([`cat-${c}`, 'surface', TEXT], [`cat-${c}`, 'surface-raised', TEXT]);
}
// Large text / UI marks
common.push(['primary', 'bg-1', LARGE]);

let failed = 0;
const rows = [];
for (const [theme, vars] of [['light', light], ['dark', dark]]) {
  for (const [fg, bg, min] of common) {
    const r = ratio(vars, fg, bg);
    const ok = r + 1e-9 >= min;
    if (!ok) failed++;
    rows.push(`${ok ? '  ok ' : 'FAIL '} ${theme.padEnd(5)} --${fg} on --${bg}: ${r.toFixed(2)} (min ${min})`);
  }
}

const verbose = process.argv.includes('--verbose');
for (const row of rows) if (verbose || row.startsWith('FAIL')) console.log(row);
if (failed) {
  console.error(`\ncheck-contrast: ${failed} pair(s) below WCAG AA. Fix src/styles/tokens.css.`);
  process.exit(1);
}
console.log(`check-contrast: ${rows.length} token pairs pass WCAG AA in light and dark.`);
