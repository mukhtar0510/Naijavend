# Kwaravend design system

Status: **R1 in progress** (REDESIGN.md §2). Source of truth for colour, motion,
z-index and depth: [`apps/storefront/src/styles/tokens.css`](../apps/storefront/src/styles/tokens.css).
Category icons and colours: [`apps/storefront/src/lib/categories.tsx`](../apps/storefront/src/lib/categories.tsx).
Audit and owner decisions: [DESIGN_AUDIT.md](DESIGN_AUDIT.md).

## Colour

Owner decision (21 Nov 2026): **blue is the main colour, with white, green and black.**
(This replaces the earlier emerald/amber blend.)

- **Brand (`--primary`)**: blue. `#1D4ED8` in light, bright `#4F8CFF` in dark.
- **Accent (`--accent`)**: green. `#047857` in light, `#34D399` in dark (open now, money in, highlights).
- **Surfaces**: white and blue-white (`#F5F8FF` page, `#FFFFFF` cards) in light; black (`#0A0D14` page, `#11151F` cards, `#1A2030` raised) in dark.
- **Text**: near-black `#0A0F1A` in light, `#EEF2FA` in dark.
- **Info** sky `#0369A1` / `#38BDF8`. Amber is kept only for warnings and rating stars (`--star`).
- **Map**: blue-white streets with blue water in light; black-and-navy land with blue roads and water in dark (`MAP_PALETTE` in `lib/mapFactory.ts`). Selected pins ring in blue, open-now pulses green.

Text on brand fills uses `--on-primary` / `--on-accent` (white in light, near-black in dark), never a hard-coded white.

### Contrast (WCAG 2.2 AA, 4.5:1 for text)

| Pair | Light | Dark |
| --- | ---: | ---: |
| Text on page | 18.0 | 17.3 |
| Muted text on card | 7.5 | 7.4 |
| Blue (primary) on page / card | 6.3 – 6.7 | 6.0 / 5.7 |
| Text on blue button | 6.7 | 6.2 |
| Green (accent) text | 5.5 (on white), 4.9 (on green tint) | 10.1 |
| Text on green fill | 5.5 | 9.8 |
| Info | 5.9 | 8.5 |
| Success / warning / danger | 5.0 / 5.9 / 5.6 | 10.5 / 10.9 / 6.6 |

Re-check with any WCAG contrast tool if you change a value.

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

## Icons

**Lucide only** (`lucide-react`, ISC licence, tree-shaken inline SVG). No emojis in the app's own UI.
Categories use `<CategoryIcon category="…" />`. Map pins (plain HTML) copy the same icon's SVG from a hidden
sprite. The emoji count is tracked by `apps/storefront/scripts/design-audit.py`.

## Motion

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
