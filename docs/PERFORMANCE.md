# Performance audit — landing page

## Method

- Lighthouse 12.8.2, mobile preset (default throttling), headless Chrome.
- Target: local production build (`next build` + `next start`), so the numbers
  describe the code, not the Vercel edge.
- JSON reports parsed for category scores and per-audit detail.

## Environment caveat — read before trusting the score

This machine cannot produce an absolute Lighthouse score. A trivial static page
(`/offline`, 100 DOM nodes, no scripts) scores **60** with **2.6 s TBT** on the
same rig, which is not a plausible real-device result. Style & Layout alone was
measured at 6.1 s for 364 nodes.

Consequence: the absolute performance score (58–69 across runs) is dominated by
machine noise. **Only deltas between runs on this rig are meaningful.** The 85+
target from T02 is therefore **not validated**.

## What was measured

| Metric | Before | After |
| --- | --- | --- |
| Google Fonts CSS request | 2.0 s, render-blocking, 21 families | gone |
| First Contentful Paint | 2.5 s | 1.3–1.7 s |
| Cumulative Layout Shift | 0.1 | 0 |
| Total transfer | 248 KiB | 248 KiB |
| JS on the landing route | 96.3 kB | 96.3 kB |
| Landing CSS (gzip) | ~59 KB | **43.7 KB** |

## Changes

1. **Core fonts self-hosted** (`next/font/google`: Sora, Inter, JetBrains Mono).
   The `@font-face` rules are inlined, files come from our origin, and the
   fallback is metric-matched — so no cross-origin stylesheet and no reflow.
2. **Theme font library moved off the root layout.** The 21 seller-theme
   families had been loaded on every page (~1.6 s of render-blocking CSS). They
   now load only where a theme font is rendered: `/s/[slug]` and the appearance
   editors, via `<ThemeFonts />`.
3. `--font-heading` / `--font-body` / `--font-mono` now prefer the self-hosted
   variables with the literal family names as fallback.

## CSS split

Measured on the built landing page by summing every `/_next/static/css` link:
59 KB → **43.7 KB** (−26%).

1. `admin.css` → `/admin` only. No public page ships it.
2. `locations-lightbox.css` → `/s/[slug]` layout.
3. `/` moved into its own `(landing)` route group with a layout that imports
   `header.css` instead of `marketplace-v2.css`. The header rules (41 rules,
   including their media queries) were extracted into `header.css`
   (`tmp/extract-header-css.mjs`, selector diff verified empty).
4. `marketplace-v2.css` moved from the root layout into the `(marketplace)` and
   `(buyer-auth)` layouts, which are the only groups using `nv-*` classes.

Checked after the split: the landing still loads brand-hero, header, button and
footer rules; `/home` still loads marketplace-v2; `/account/signin` still loads
it. `/home` CSS is unchanged at 52.0 KB.

A class-usage check (187 classes in the rendered landing HTML) shows the page
really does use rules from base, chrome, components, interactions, brand and
mobile, so those cannot be dropped without a landing-specific stylesheet.

## Remaining opportunities (not done)

- A landing-specific stylesheet (rather than the full design system) would cut
  the remaining 43.7 KB. It is a redesign, not a split.
- TBT is the weakest synthetic metric here and the least trustworthy on this
  machine. Re-measure on a clean machine or against the deployed URL before
  deciding to chase it.
- `LanguageDock` and `PwaRegister` are mounted globally; deferring them would
  cut initial JS but they are small compared to the CSS blocking cost.
