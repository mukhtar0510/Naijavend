# R0 — Design audit

Date: 20 November 2026. Scope: `apps/storefront/src` (the app that deploys).
Re-run any time with `python apps/storefront/scripts/design-audit.py`.
The repo/stack audit (T00) is in [AUDIT.md](AUDIT.md).

## Owner decisions (asked before R1/R3)

| Question | Decision |
| --- | --- |
| Colour scheme (REDESIGN 2.6) | **Blend** the brief's emerald + sun-amber scheme with the current palette (blue, gold, Naija green). See `DESIGN.md` → Colour. |
| Icon set | **Lucide** (`lucide-react`, already installed — no new dependency) |
| 3D models | **Built in code** as original low-poly shapes (no bought/licensed assets) |
| Demo stores | **Labelled example stores in Ilorin**, owned by a dedicated examples account, marked `is_example`, shown as "Example store · Sample data", ordering disabled, hideable with one flag |
| Map | MapLibre GL + OpenFreeMap vector tiles, **Ilorin-only** (Discover and store pages) — shipped before R0 |

Not yet decided (asked again before R3): landing starts in the lite tier on unknown devices; paid plans show "Coming soon" + waitlist; store stories launch after moderation. The brief's defaults are assumed until the owner says otherwise.

## Missing inputs

`BUILD.md` and `KWARAVEND_IMPROVEMENTS.md`, which REDESIGN.md extends, are **not in the repo**. Where REDESIGN.md defers to them (task acceptance criteria), the existing `docs/AUDIT.md`, `CLAIMS_AUDIT.md` and `HARDENING.md` are used instead. Ask the owner for the two files before R5.

## 1. Emojis in the UI — 224 in 74 files

Most frequent: 📍 ×12, 🚚 ×11, 🏪 ×10, 🛍️ ×10, ✓ ×10, 💬 ×9, ✨ ×9, ★ ×8, ✅ ×6, 📅 ×6, 📱 ×6, 🧾 ×5, 🇳🇬 ×4, ⚡ ×4, 🖼 ×4, plus ~40 others.

Worst files:

| Count | File |
| ---: | --- |
| 16 | `app/(seller-auth)/dashboard/onboarding/page.tsx` |
| 13 | `app/(marketplace)/account/page.tsx` |
| 13 | `app/dashboard/ai/AiStudio.tsx` |
| 10 | `app/(marketplace)/home/page.tsx` |
| 10 | `lib/brand-copy.ts` |
| 7 | `app/(marketplace)/account/alerts/page.tsx` |
| 7 | `app/(seller-auth)/dashboard/signin/page.tsx` |
| 6 | `rankings/page.tsx`, `ListingEditor.tsx`, `s/[slug]/page.tsx`, `NearbyStores.tsx` |

Plus the **category emoji map** in `packages/shared/src/store.ts` (`categoryEmoji`, ~30 categories), used by 10 storefront files including the map pins, Discover chips and store cards. This is the single biggest visible source and is replaced first by `categories.ts` (Lucide icon + colour per category).

## 2. Buttons — 224 raw `<button>` elements in 78 files, 24 button classes

| Uses | Class |
| ---: | --- |
| 233 | `btn` |
| 120 | `btn-sm` |
| 116 | `btn-outline` |
| 92 | `btn-primary` |
| 24 | `btn-lg` |
| 6 / 5 / 5 / 5 / 4 | `btn-black`, `btn-white`, `btn-ghost-light`, `btn-whatsapp`, `btn-ghost` |
| 1–5 each | `share-btn`, `nv-map-btn`, `ai-tool-btn(-open)`, `dispute-report-btn`, `cat-more-btn`, `ob-step-btn`, `btn-google`, `loc-photo-btn`, `pwa-install-btn`, `nv-header-search-btn`, `nv-map-toggle-btn`, `brand-layer-btn`, `sdg-ghost-btn` |

There is also an unused-in-practice shadcn `components/ui/button.tsx`. Target: one `Button` / `IconButton` / `FAB` in `components/ui`, mapping `btn-primary` → `primary`, `btn-outline` → `secondary`, `btn-ghost*` → `tertiary`, `btn-black`/`btn-white` → `secondary` on the right surface, `btn-whatsapp` → `primary` with the WhatsApp icon.

## 3. Category and filter controls — 37 chip/pill classes

Main families: `brand-chip` (12), `nv-pill` + `-invert`/`-dot` (16), `ai-chip` (8), `nv-map-cat` (map), `nv-cat-tile` / `nv-cat-rail` (home), `rank-chip` / `nv-rank-cat` (rankings), `ob-quick-chip` (onboarding), `nv-mapband-chip`, `store-ribbon-tag`, `nv-mb-tag`.
Target: one `Chip` (with icon slot, selected state, count badge) plus `SegmentedControl`, `Badge`, `Tag`, `Toggle`.

## 4. Colour

Tokens live in `styles/base.css` (`--blue` is the de-facto brand colour, plus `--gold`, `--naija`), but many CSS files and some components use raw hex values (e.g. map route colours, status dots `#16a34a` / `#9ca3af`). Target: one tokens file, semantic names (`--primary`, `--accent`, `--info`…), legacy names kept as aliases during migration, then a lint rule against raw hex outside the tokens file and the map style.

## 5. Order of fixes (R1)

1. Tokens + blended palette (light and dark) with legacy aliases → whole app re-skins at once.
2. `categories.ts` + `CategoryIcon` → removes the emoji map from pins, chips and cards.
3. `Icon`, `Button`, `Chip` components in `components/ui`.
4. Emoji check script (`scripts/check-emoji.mjs`) — report mode now, failing mode once the count reaches zero.
5. Sweep the worst files above, then the long tail; migrate raw buttons file by file.
