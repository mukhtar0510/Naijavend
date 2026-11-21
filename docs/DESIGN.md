# Kwaravend design system

Status: **R1 in progress** (REDESIGN.md §2). Source of truth for colour, motion,
z-index and depth: [`apps/storefront/src/styles/tokens.css`](../apps/storefront/src/styles/tokens.css).
Category icons and colours: [`apps/storefront/src/lib/categories.tsx`](../apps/storefront/src/lib/categories.tsx).
Audit and owner decisions: [DESIGN_AUDIT.md](DESIGN_AUDIT.md).

## Colour

**REDESIGN_V2 §2 (decided):** blue, black, gold, white and green. Values are the V2 tables, verbatim, in `tokens.css`.

| Colour | Job | Share |
| --- | --- | --- |
| Black `--bg-0` `#05070D` (dark) | Canvas | ~60% |
| Blue `--primary` `#4D94FF` / `#1456E0` | Brand, buttons, links, selected, info, in transit | ~25% |
| White `--text` `#F4F7FF` (dark) | Text on dark; surfaces in light | — |
| Gold `--gold` `#FFC83D` / `#8A5F00`, fills `--gold-fill` | The ONE focal highlight per viewport, featured, stars, story ring | ≤ 5% |
| Green `--green` `#34E39B` / `#0B7A4B` | Open, live, success, paid, money in, growth. Plus the nav "Sell free" button (`cta`) | small accents |

Rules: at most one gold focal element per viewport (rating stars excepted); green never decorates; all primary
buttons are blue; **never white text on dark-theme blue** (3.0:1) — use `--on-primary`.

Contrast is enforced by `apps/storefront/scripts/check-contrast.mjs` (92 pairs, light and dark, including every
category colour on `--surface` and `--surface-raised`). It runs in `pnpm build` and fails under 4.5:1.

shadcn names map onto our tokens in `tailwind.config.js` (Tailwind 3, so no `@theme inline`): `background`→`--bg-0`,
`card`→`--surface`, `popover`/`secondary`/`accent`→`--surface-raised`, `muted`→`--bg-1`, `primary`, `destructive`→`--danger`,
`ring`→`--primary`, `chart-1..5`, `sidebar*`, plus custom `gold` (`bg-gold-fill`, `text-gold`) and `green`.

Gradients `--grad-brand`, `--grad-gold`, `--grad-skyline`; glows `--glow-blue`, `--glow-gold-rim`; glass `.glass`
(solid fallback under Reduce effects or no `backdrop-filter`); elevation `--e1`…`--e5` (`.e1`…`.e5`, `shadow-e3`).

`--accent` stays as a legacy alias of gold for older CSS. It is **not** shadcn's accent.

### Status colours (always with an icon and a label)

Pending → warning · Confirmed → info · Preparing → accent · Ready → primary · Out for delivery → info ·
Delivered / completed → success · Cancelled / failed → danger · Awaiting payment confirmation → warning ·
Paid (confirmed by seller) → success.

### Category colours

Eleven groups from REDESIGN 2.6 (`--cat-food`, `--cat-cakes`, `--cat-beauty`, `--cat-hair`, `--cat-fashion`,
`--cat-accessories`, `--cat-gadgets`, `--cat-groceries`, `--cat-home`, `--cat-tutors`, `--cat-other`), light
and dark values in `tokens.css`. The app's 32 store categories map onto these groups in `categories.tsx`.
Map pins use the group colour as their ring.

### Glass

`--glass-bg`, `--glass-border`, `--glass-blur`. Turned off automatically (solid `--surface-raised`) when
`backdrop-filter` is unsupported or `html.reduce-effects` is set.

### Legacy aliases

Older CSS still uses `--blue`, `--naija`, `--gold`, `--black` and friends. They are now **aliases** of the
semantic tokens (e.g. `--blue → --primary`), so the whole app re-skinned in one change. Migrate rules to the
semantic names when you touch them; delete the aliases once nothing uses them.

**Open item:** about 344 raw hex values remain in older stylesheets. The "no raw hex outside tokens" lint
rule will be switched on once they are migrated.

## Dropdowns and menus

One look everywhere (`styles/system.css`): native `<select>` is a pill field with a token-drawn chevron and a
44px touch target; dropdown triggers (category picker, language, mobile menu) look like secondary buttons; every
popover panel (category "more", category picker, language menu, mobile menu, map layers) uses the same surface,
radius, shadow and entry animation, with 44px menu rows; `<details>` accordions get one rotating chevron. Any
`<button>` without a class falls back to the secondary button look, so no browser-default button can appear.

## Icons

**Lucide only** (`lucide-react`, ISC licence, tree-shaken inline SVG). No emojis in the app's own UI.
Categories use `<CategoryIcon category="…" />`. Map pins (plain HTML) copy the same icon's SVG from a hidden
sprite. The emoji count is tracked by `apps/storefront/scripts/design-audit.py`.

## Motion

**Motion** (`motion/react`, MIT, pinned 14.10.1) is the only animation library; framer-motion was removed. Presets
live in `src/lib/motion.ts` (`DUR`, `EASE`, `SPRING`, `PRESS`, `LIFT`, `fadeUp`, `scaleIn`, `stagger()`, `IN_VIEW`).
`<MotionProvider>` in the root layout sets `MotionConfig reducedMotion` from `useReduceEffects()` — the OS setting OR
the Reduce effects switch (`html.reduce-effects`, applied pre-paint on every page).

## Depth components (V2 §3.3)

`src/components/depth/`: `TiltCard` (≤ 6° pointer tilt, cursor light, opposite shadow, focus lift; none on touch or
reduced), `DepthStage` + `DepthLayer` (z0–z5 with scroll parallax), `ParallaxStack`, `IsoBlock` + `IsoScene` (isometric
SVG, theme-aware). `Model3D` is not built: it needs three.js, which waits on the owner's 3D-model decision.

## Type

Display: **Inter Tight** 600–800 (`--font-display`, also `--font-heading`), tracking about −0.03em on big headlines.
Body: Inter. Numbers and prices: JetBrains Mono. All self-hosted by `next/font`.

Durations `--dur-1..4` = 120 / 200 / 320 / 500 ms. Easings `--ease-standard`, `--ease-emphasised`,
`--ease-spring`. Pressed state: `scale(var(--press-scale))` = 0.97. Animate transform and opacity only;
honour `prefers-reduced-motion`.

## Z-index and depth

`--z-base` 0 · `--z-raised` 10 · `--z-sticky` 100 · `--z-header` 200 · `--z-overlay` 900 · `--z-modal` 950 ·
`--z-toast` 1000. Landing-scene depth: `--depth-sky` −1000 → `--depth-fore` 400.

## Example stores

Sample-data stores (`stores.is_example`) are shown with an "Example store · Sample data" banner and "Example"
tags, can't take orders or bookings, are excluded from the sitemap and search indexing, and can all be hidden
with `NEXT_PUBLIC_FLAG_EXAMPLE_STORES=off`. Seed or remove them with
`node --env-file=.env.local scripts/seed-example-stores.mjs [--remove]` (from `apps/storefront`).

## Still to build in R1

`Icon`, `Button` / `IconButton` / `FAB`, `Chip`, `SegmentedControl`, `Badge`, `Tag`, `Toggle` in
`components/ui`; a playground; the no-emoji and no-raw-button lint checks; the remaining emoji sweep
(224 → 0) and raw `<button>` migration (224 in 78 files).
