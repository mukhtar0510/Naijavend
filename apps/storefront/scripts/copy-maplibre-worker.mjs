// MapLibre GL v6 parses vector tiles in a separate ES-module worker file
// (maplibre-gl-worker.mjs). Next 14's webpack doesn't emit it, so the browser
// fetched an HTML page instead and the map stayed blank. We serve the worker
// as a static file and point MapLibre at it (see src/lib/mapFactory.ts).
// Runs before `next dev` / `next build` so it always matches the installed version.
import { copyFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const pkgDir = dirname(require.resolve('maplibre-gl/package.json'));
const outDir = join(here, '..', 'public', 'maplibre');

mkdirSync(outDir, { recursive: true });
copyFileSync(join(pkgDir, 'dist', 'maplibre-gl-worker.mjs'), join(outDir, 'maplibre-gl-worker.mjs'));
console.log('maplibre worker copied to public/maplibre/');
