// Fails (exit 1) if a pictographic emoji appears in the app's own UI source
// (REDESIGN R1 §2.3: "zero emojis in the UI"). Runs before every build.
// User-generated content lives in the database, not in src/, so it is unaffected.
// Typographic symbols (arrows, ·, ₦, —) are allowed.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'src');
const EMOJI =
  /[\u{1F300}-\u{1FAFF}\u{1F000}-\u{1F2FF}\u{1F1E6}-\u{1F1FF}☀-⛿✀-➿⭐⭕⬛⬜⬅-⬇⌚⌛⏩-⏺]/u;

const hits = [];
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(tsx?|css)$/.test(name)) {
      readFileSync(p, 'utf8')
        .split('\n')
        .forEach((line, i) => {
          if (EMOJI.test(line)) hits.push(`${relative(root, p)}:${i + 1}: ${line.trim().slice(0, 120)}`);
        });
    }
  }
}
walk(root);

if (hits.length) {
  console.error(`Emoji check failed — ${hits.length} emoji line(s) in src/ (use a Lucide icon instead):`);
  for (const h of hits) console.error('  ' + h);
  process.exit(1);
}
console.log('Emoji check passed: no emojis in src/.');
