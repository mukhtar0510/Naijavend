// Generates docs/LANDING_LAYERS.md from src/components/landing/scene/layers.ts
// (REDESIGN 4.2). Run from apps/storefront: node scripts/gen-landing-layers-doc.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, '..', 'src/components/landing/scene/layers.ts'), 'utf8');
const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const mod = { exports: {} };
new Function('module', 'exports', js)(mod, mod.exports);
const { SCENE_LAYERS, sceneSummary } = mod.exports;
const s = sceneSummary();

const BANDS = {
  A: 'Background', B: 'Far city', C: 'Mid street', D: 'Hero objects', E: 'Interface', F: 'Foreground',
};
let md = `# Landing scene layers

Generated from \`apps/storefront/src/components/landing/scene/layers.ts\` by
\`node scripts/gen-landing-layers-doc.mjs\`. Do not edit by hand.

**${s.total} layers**: ${s['2d']} × 2D, ${s['2.5d']} × 2.5D, ${s['3d']} × 3D.
Rendered per tier: **lite ${s.lite}** · **standard ${s.standard}** · **full ${s.full}**.

## Tiers

| Tier | Layers | Motion | When |
| --- | ---: | --- | --- |
| lite | ${s.lite} | none (still poster) | default until the FPS probe passes; reduced motion, Save-Data, 2G/3G, < 4 GB memory or < 4 cores, "Reduce effects" on |
| standard | ${s.standard} | scroll parallax, pointer tilt | probe ≥ 40 fps |
| full | ${s.full} | everything | probe ≥ 50 fps on ≥ 8 cores and ≥ 8 GB |

Force a tier with \`?layers=lite|standard|full\`. In development, \`?sceneDebug\` shows tier, layer count and FPS.

## 3D rendering

The 20 "3D" layers (phone, stall, scooter and rider, map pins, parcels, cart,
order tag, mid-street boxes) are original low-poly objects built in code with
CSS 3D transforms (\`preserve-3d\` boxes and tilted planes). They are not WebGL
glTF models yet — no three.js is shipped, which keeps the page well inside the
lite and full download budgets. Moving them to a single WebGL canvas is a
possible later step if the owner wants richer models.

## All layers

| ID | Name | Type | Band | Depth | Parallax | Scroll range | Tier | Interaction | Cost |
| --- | --- | --- | --- | ---: | ---: | --- | --- | --- | --- |
`;
for (const l of SCENE_LAYERS) {
  md += `| ${l.id} | ${l.name} | ${l.type} | ${l.band} ${BANDS[l.band]} | ${l.depth} | ${l.parallaxSpeed} | ${l.scrollRange[0]}–${l.scrollRange[1]} | ${l.tier} | ${l.interaction} | ${l.cost} |\n`;
}
writeFileSync(join(here, '..', '..', '..', 'docs', 'LANDING_LAYERS.md'), md);
console.log(`docs/LANDING_LAYERS.md written (${s.total} layers).`);
