// Landing scene layer manifest (REDESIGN R3 §4.2) — L001…L100.
// One continuous story: WhatsApp chat → storefront → a doorstep in Ilorin.
// docs/LANDING_LAYERS.md is generated from this file
// (node scripts/gen-landing-layers-doc.mjs).
//
// Types: 2d = flat SVG/gradient/text · 2.5d = flat plane at a depth with
// parallax/tilt · 3d = a dimensional object. NOTE: the 3D objects are built
// in code as low-poly CSS 3D shapes (preserve-3d boxes and planes), not WebGL
// models yet — see LANDING_LAYERS.md "3D rendering".
//
// All artwork is original and drawn in code. Landmarks are generic, not real
// Ilorin buildings (REDESIGN §4.2 B).

export type LayerType = '2d' | '2.5d' | '3d';
export type Tier = 'lite' | 'standard' | 'full';
export type Cost = 'low' | 'medium' | 'high';
export type Interaction = 'none' | 'hover' | 'pointer' | 'scroll';

export type Kind =
  | 'sky' | 'sun' | 'cloud' | 'haze' | 'pattern' | 'grain' | 'vignette' | 'stars' | 'horizon'
  | 'building' | 'tree' | 'hill' | 'dome' | 'powerline'
  | 'stall' | 'awning' | 'sign' | 'person' | 'bus' | 'bike' | 'billboard' | 'shopfront'
  | 'box3d' | 'phone3d' | 'scooter3d' | 'pin3d' | 'parcel3d' | 'tag3d' | 'cart3d'
  | 'card' | 'bubble' | 'connector' | 'step'
  | 'leaf' | 'dust' | 'rays' | 'edgeblur' | 'cursorglow' | 'progress';

export interface SceneLayer {
  id: string; // L001…L100
  name: string;
  type: LayerType;
  band: 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
  kind: Kind;
  /** Depth on the --depth scale: negative = far, positive = near. */
  depth: number;
  /** Scroll parallax multiplier (0 = fixed, 1 = moves with the page). */
  parallaxSpeed: number;
  /** Scroll progress (0–1 of the hero) over which the layer animates. */
  scrollRange: [number, number];
  /** Lowest quality tier that renders this layer. */
  tier: Tier;
  interaction: Interaction;
  cost: Cost;
  /** Placement in % of the scene box, size in px (scaled with the scene). */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Colour token or variant index the renderer understands. */
  tone?: string;
  label?: string;
  variant?: number;
}

let n = 0;
const id = () => `L${String(++n).padStart(3, '0')}`;
const L = (l: Omit<SceneLayer, 'id'>): SceneLayer => ({ id: id(), ...l });

// Deterministic pseudo-random so SSR and client agree.
let seed = 7;
const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);

const layers: SceneLayer[] = [];

// ---------------------------------------------------------------- A. Background (12 × 2D)
layers.push(
  L({ name: 'Sky gradient', type: '2d', band: 'A', kind: 'sky', depth: -1000, parallaxSpeed: 0, scrollRange: [0, 1], tier: 'lite', interaction: 'none', cost: 'low', x: 0, y: 0, w: 100, h: 100 }),
  L({ name: 'Sun glow', type: '2d', band: 'A', kind: 'sun', depth: -980, parallaxSpeed: 0.05, scrollRange: [0, 1], tier: 'lite', interaction: 'none', cost: 'low', x: 72, y: 14, w: 260, h: 260 }),
  L({ name: 'Horizon light', type: '2d', band: 'A', kind: 'horizon', depth: -960, parallaxSpeed: 0.06, scrollRange: [0, 1], tier: 'lite', interaction: 'none', cost: 'low', x: 0, y: 46, w: 100, h: 20 }),
);
for (let i = 0; i < 4; i++) {
  layers.push(L({ name: `Cloud ${i + 1}`, type: '2d', band: 'A', kind: 'cloud', depth: -940 + i * 10, parallaxSpeed: 0.08 + i * 0.02, scrollRange: [0, 1], tier: i < 2 ? 'lite' : 'standard', interaction: 'scroll', cost: 'low', x: 6 + i * 24, y: 8 + (i % 2) * 9, w: 150 + i * 20, h: 50, variant: i }));
}
layers.push(
  L({ name: 'Haze band', type: '2d', band: 'A', kind: 'haze', depth: -900, parallaxSpeed: 0.1, scrollRange: [0, 1], tier: 'standard', interaction: 'none', cost: 'low', x: 0, y: 38, w: 100, h: 18 }),
  L({ name: 'Dot pattern', type: '2d', band: 'A', kind: 'pattern', depth: -890, parallaxSpeed: 0.12, scrollRange: [0, 1], tier: 'standard', interaction: 'none', cost: 'low', x: 0, y: 0, w: 100, h: 60 }),
  L({ name: 'Film grain', type: '2d', band: 'A', kind: 'grain', depth: -880, parallaxSpeed: 0, scrollRange: [0, 1], tier: 'full', interaction: 'none', cost: 'medium', x: 0, y: 0, w: 100, h: 100 }),
  L({ name: 'Vignette', type: '2d', band: 'A', kind: 'vignette', depth: -870, parallaxSpeed: 0, scrollRange: [0, 1], tier: 'lite', interaction: 'none', cost: 'low', x: 0, y: 0, w: 100, h: 100 }),
  L({ name: 'Night stars (dark mode)', type: '2d', band: 'A', kind: 'stars', depth: -990, parallaxSpeed: 0.03, scrollRange: [0, 1], tier: 'standard', interaction: 'none', cost: 'low', x: 0, y: 0, w: 100, h: 45 }),
);

// ---------------------------------------------------------------- B. Far city (20 × 2.5D)
for (let i = 0; i < 9; i++) {
  layers.push(L({ name: `Low-rise rooftop ${i + 1}`, type: '2.5d', band: 'B', kind: 'building', depth: -700 + i * 4, parallaxSpeed: 0.16, scrollRange: [0, 1], tier: i % 3 === 0 ? 'lite' : 'standard', interaction: 'scroll', cost: 'low', x: i * 11.5 - 2, y: 44 - Math.round(rnd() * 8), w: 90 + Math.round(rnd() * 60), h: 70 + Math.round(rnd() * 70), variant: i }));
}
for (let i = 0; i < 4; i++) {
  layers.push(L({ name: `Tree cluster ${i + 1}`, type: '2.5d', band: 'B', kind: 'tree', depth: -660 + i * 4, parallaxSpeed: 0.2, scrollRange: [0, 1], tier: 'standard', interaction: 'scroll', cost: 'low', x: 8 + i * 25, y: 52, w: 70, h: 80, variant: i }));
}
for (let i = 0; i < 3; i++) {
  layers.push(L({ name: `Hill ${i + 1}`, type: '2.5d', band: 'B', kind: 'hill', depth: -760 + i * 6, parallaxSpeed: 0.1 + i * 0.02, scrollRange: [0, 1], tier: i === 0 ? 'lite' : 'standard', interaction: 'scroll', cost: 'low', x: -10 + i * 38, y: 40, w: 620, h: 160, variant: i }));
}
layers.push(
  L({ name: 'Generic dome', type: '2.5d', band: 'B', kind: 'dome', depth: -690, parallaxSpeed: 0.16, scrollRange: [0, 1], tier: 'standard', interaction: 'scroll', cost: 'low', x: 58, y: 36, w: 90, h: 110 }),
  L({ name: 'Water tank', type: '2.5d', band: 'B', kind: 'dome', depth: -688, parallaxSpeed: 0.16, scrollRange: [0, 1], tier: 'full', interaction: 'scroll', cost: 'low', x: 18, y: 34, w: 50, h: 90, variant: 1 }),
);
for (let i = 0; i < 2; i++) {
  layers.push(L({ name: `Far power line ${i + 1}`, type: '2.5d', band: 'B', kind: 'powerline', depth: -640 + i * 5, parallaxSpeed: 0.22, scrollRange: [0, 1], tier: 'full', interaction: 'scroll', cost: 'low', x: 0, y: 30 + i * 4, w: 100, h: 40, variant: i }));
}

// ---------------------------------------------------------------- C. Mid street (24: 8 × 2D, 12 × 2.5D, 4 × 3D)
const midFlat: Array<[Kind, string]> = [
  ['sign', 'Shop sign: Provisions'], ['sign', 'Shop sign: Phones'], ['person', 'Shopper silhouette'], ['person', 'Seller silhouette'],
  ['person', 'Child with balloon'], ['billboard', 'Billboard: Open your store'], ['sign', 'Street sign'], ['person', 'Okada rider silhouette'],
];
midFlat.forEach(([kind, name], i) =>
  layers.push(L({ name, type: '2d', band: 'C', kind, depth: -320 + i * 3, parallaxSpeed: 0.42, scrollRange: [0, 1], tier: i < 3 ? 'lite' : 'standard', interaction: 'scroll', cost: 'low', x: 4 + i * 12, y: 60 + (i % 2) * 4, w: kind === 'billboard' ? 150 : 46, h: kind === 'billboard' ? 80 : 90, variant: i, label: name.split(': ')[1] })),
);
const midPlanes: Array<[Kind, string]> = [
  ['stall', 'Market stall'], ['stall', 'Fruit stall'], ['awning', 'Striped awning'], ['awning', 'Blue awning'],
  ['shopfront', 'Shop front: tailor'], ['shopfront', 'Shop front: cakes'], ['shopfront', 'Shop front: gadgets'], ['bus', 'Danfo-style bus'],
  ['bike', 'Parked bike'], ['bike', 'Parked okada'], ['stall', 'Kiosk'], ['awning', 'Umbrella stand'],
];
midPlanes.forEach(([kind, name], i) =>
  layers.push(L({ name, type: '2.5d', band: 'C', kind, depth: -280 + i * 4, parallaxSpeed: 0.5, scrollRange: [0, 1], tier: i < 4 ? 'lite' : i < 9 ? 'standard' : 'full', interaction: 'scroll', cost: 'low', x: -2 + i * 9, y: 62 + (i % 3) * 2, w: kind === 'bus' ? 170 : 96, h: kind === 'bus' ? 70 : 84, variant: i, label: name.split(': ')[1] })),
);
['3D stall', '3D kiosk', '3D bike', '3D parasol'].forEach((name, i) =>
  layers.push(L({ name, type: '3d', band: 'C', kind: 'box3d', depth: -220 + i * 6, parallaxSpeed: 0.55, scrollRange: [0, 1], tier: i < 1 ? 'standard' : 'full', interaction: 'scroll', cost: 'medium', x: 12 + i * 22, y: 70, w: 70, h: 60, variant: i })),
);

// ---------------------------------------------------------------- D. Hero objects (16 × 3D)
layers.push(
  L({ name: 'Phone showing a store page', type: '3d', band: 'D', kind: 'phone3d', depth: 0, parallaxSpeed: 0.7, scrollRange: [0, 0.6], tier: 'lite', interaction: 'pointer', cost: 'medium', x: 64, y: 22, w: 190, h: 380 }),
  L({ name: 'Storefront stall', type: '3d', band: 'D', kind: 'box3d', depth: 20, parallaxSpeed: 0.72, scrollRange: [0.1, 0.7], tier: 'standard', interaction: 'scroll', cost: 'medium', x: 44, y: 66, w: 120, h: 90, variant: 4 }),
  L({ name: 'Delivery scooter and rider', type: '3d', band: 'D', kind: 'scooter3d', depth: 40, parallaxSpeed: 0.85, scrollRange: [0.2, 1], tier: 'standard', interaction: 'scroll', cost: 'high', x: 8, y: 74, w: 150, h: 110 }),
  L({ name: 'Order tag', type: '3d', band: 'D', kind: 'tag3d', depth: 60, parallaxSpeed: 0.9, scrollRange: [0.3, 1], tier: 'full', interaction: 'pointer', cost: 'medium', x: 86, y: 58, w: 90, h: 50 }),
  L({ name: 'Cart', type: '3d', band: 'D', kind: 'cart3d', depth: 50, parallaxSpeed: 0.88, scrollRange: [0.1, 0.9], tier: 'full', interaction: 'pointer', cost: 'medium', x: 30, y: 80, w: 70, h: 60 }),
);
for (let i = 0; i < 6; i++) {
  layers.push(L({ name: `Floating map pin ${i + 1}`, type: '3d', band: 'D', kind: 'pin3d', depth: 10 + i * 6, parallaxSpeed: 0.6 + i * 0.05, scrollRange: [0, 1], tier: i < 2 ? 'standard' : 'full', interaction: 'pointer', cost: 'medium', x: 8 + i * 15, y: 30 + (i % 3) * 9, w: 34, h: 48, variant: i }));
}
for (let i = 0; i < 5; i++) {
  layers.push(L({ name: `Parcel box ${i + 1}`, type: '3d', band: 'D', kind: 'parcel3d', depth: 30 + i * 4, parallaxSpeed: 0.8 + i * 0.03, scrollRange: [0.2, 1], tier: i < 1 ? 'standard' : 'full', interaction: 'scroll', cost: 'medium', x: 20 + i * 6, y: 84 - (i % 2) * 5, w: 40, h: 40, variant: i }));
}

// ---------------------------------------------------------------- E. Interface (16: 8 × 2D, 8 × 2.5D)
const uiFlat: Array<[Kind, string]> = [
  ['bubble', 'WhatsApp message bubble'], ['bubble', 'Icon bubble: store'], ['bubble', 'Icon bubble: truck'], ['connector', 'Connector line 1'],
  ['connector', 'Connector line 2'], ['step', 'Step marker 1'], ['step', 'Step marker 2'], ['step', 'Step marker 3'],
];
uiFlat.forEach(([kind, name], i) =>
  layers.push(L({ name, type: '2d', band: 'E', kind, depth: 180 + i * 4, parallaxSpeed: 0.95, scrollRange: [i * 0.08, 1], tier: i < 3 ? 'lite' : 'standard', interaction: 'scroll', cost: 'low', x: 6 + i * 11, y: 20 + (i % 4) * 12, w: kind === 'connector' ? 140 : 44, h: 44, variant: i, label: name })),
);
const uiCards: Array<[string, string]> = [
  ['New order', 'info'], ['Awaiting your confirmation', 'warning'], ['Paid (confirmed by seller)', 'success'], ['Out for delivery', 'info'],
  ['Ready for pickup', 'primary'], ['Delivered', 'success'], ['Share your store link', 'primary'], ['Open now', 'accent'],
];
uiCards.forEach(([label, tone], i) =>
  layers.push(L({ name: `Floating card: ${label}`, type: '2.5d', band: 'E', kind: 'card', depth: 200 + i * 6, parallaxSpeed: 1.0 + (i % 3) * 0.06, scrollRange: [i * 0.07, 1], tier: i < 2 ? 'lite' : i < 5 ? 'standard' : 'full', interaction: 'hover', cost: 'low', x: [4, 40, 14, 48, 6, 32, 54, 24][i], y: [14, 10, 40, 38, 64, 58, 70, 86][i], w: 190, h: 52, tone, label })),
);

// ---------------------------------------------------------------- F. Foreground (12 × 2D)
for (let i = 0; i < 4; i++) {
  layers.push(L({ name: `Foreground leaf ${i + 1}`, type: '2d', band: 'F', kind: 'leaf', depth: 400 + i * 5, parallaxSpeed: 1.35, scrollRange: [0, 1], tier: i < 1 ? 'standard' : 'full', interaction: 'scroll', cost: 'low', x: i % 2 === 0 ? -4 : 92, y: 70 + i * 6, w: 120, h: 120, variant: i }));
}
for (let i = 0; i < 3; i++) {
  layers.push(L({ name: `Dust motes ${i + 1}`, type: '2d', band: 'F', kind: 'dust', depth: 380 + i * 5, parallaxSpeed: 1.2, scrollRange: [0, 1], tier: 'full', interaction: 'none', cost: 'low', x: 10 + i * 30, y: 20, w: 200, h: 300, variant: i }));
}
layers.push(
  L({ name: 'Light rays', type: '2d', band: 'F', kind: 'rays', depth: 360, parallaxSpeed: 0.3, scrollRange: [0, 1], tier: 'standard', interaction: 'none', cost: 'medium', x: 50, y: 0, w: 100, h: 70 }),
  L({ name: 'Edge blur left', type: '2d', band: 'F', kind: 'edgeblur', depth: 420, parallaxSpeed: 0, scrollRange: [0, 1], tier: 'full', interaction: 'none', cost: 'medium', x: 0, y: 0, w: 6, h: 100, variant: 0 }),
  L({ name: 'Edge blur right', type: '2d', band: 'F', kind: 'edgeblur', depth: 420, parallaxSpeed: 0, scrollRange: [0, 1], tier: 'full', interaction: 'none', cost: 'medium', x: 94, y: 0, w: 6, h: 100, variant: 1 }),
  L({ name: 'Cursor glow', type: '2d', band: 'F', kind: 'cursorglow', depth: 440, parallaxSpeed: 0, scrollRange: [0, 1], tier: 'standard', interaction: 'pointer', cost: 'low', x: 50, y: 50, w: 360, h: 360 }),
  L({ name: 'Scroll progress rail', type: '2d', band: 'F', kind: 'progress', depth: 460, parallaxSpeed: 0, scrollRange: [0, 1], tier: 'lite', interaction: 'scroll', cost: 'low', x: 99, y: 10, w: 4, h: 80 }),
);

export const SCENE_LAYERS: readonly SceneLayer[] = layers;

const TIER_RANK: Record<Tier, number> = { lite: 0, standard: 1, full: 2 };
export function layersForTier(t: Tier): SceneLayer[] {
  return SCENE_LAYERS.filter((l) => TIER_RANK[l.tier] <= TIER_RANK[t]);
}

export function sceneSummary() {
  const by = (t: LayerType) => SCENE_LAYERS.filter((l) => l.type === t).length;
  return {
    total: SCENE_LAYERS.length,
    '2d': by('2d'),
    '2.5d': by('2.5d'),
    '3d': by('3d'),
    lite: layersForTier('lite').length,
    standard: layersForTier('standard').length,
    full: layersForTier('full').length,
  };
}
