# T01 — Rename report: Naijavend → Kwaravend

Date: 17 November 2026.

## What changed

The brand name is now **Kwaravend**, read from one config:

`packages/shared/src/brand.ts` → `BRAND`

| Field | Value |
| --- | --- |
| `name` | `Kwaravend` |
| `wordmark` | `Kwara` + `vend` |
| `tagline` | "Your storefront deserves more than a WhatsApp catalogue." |
| `domain` | `kwaravend.com` (config only — **not registered by this change**) |
| `supportWhatsApp` | `''` — owner must supply |
| `supportEmail` | `''` — owner must supply |
| `socials.*` | `''` — owner must supply |
| `orderPrefix` | `KV-` |
| `launchRegion` | Ilorin, Kwara State, Nigeria · 8.4966°N, 4.5421°E |

Helpers:
- `orderRef(uuid)` → `KV-3F9A1C` (derived from the order UUID, no schema change).
- `brandTitle(page?)` → `Page · Kwaravend`.

## Occurrences replaced

172 occurrences across 67 files in `apps/storefront/src` and `apps/storefront/public`, plus `packages/shared`, `packages/ai`, `apps/admin` and the root `README.md` / `package.json`.

Grouped by surface:

| Surface | Files | What changed |
| --- | --- | --- |
| Root metadata / PWA | `src/app/layout.tsx`, `src/app/manifest.ts` | title template, description, apple title, manifest name/short_name/description now read `BRAND` |
| Logo | `KwaravendLogo.tsx` (renamed from `NaijavendLogo.tsx`), `SiteHeader`, `BackToMarket`, `ParallaxHeroMark`, signin pages, dashboard chrome, `AdminConsole` | `KwaravendLogoMark` / `KwaravendWordmark`; new **K** mark replacing the **N** mark; wordmark renders `Kwara` + `vend` |
| Landing / about / FAQ / home / discover / search / rankings | 12 pages + `brand-copy.ts` | headings, prose, meta descriptions |
| Store sites `/s/[slug]` | layout, page, listing page, OG image | platform footer, OG wordmark (was "Naijacart"), cross-platform links |
| Buyer account | account pages, AI assistant page + route, signin | brand copy in headings and assistant prompts |
| Seller dashboard | dashboard layout/mobile nav, analytics, settings, verify card, onboarding, signin | wordmark, copy, AI prompts |
| Legal | terms, privacy, cookies, legal index | brand name; **the old `naijavend2026@gmail.com` contact was removed** and replaced with "contact us through the in-app chat" (no invented address) |
| Receipts / sharing | `OrderShare`, `checkout/[orderId]` | `KV-` short order reference from `orderRef()` |
| Payments internals | `src/lib/paytoken.ts` | HMAC salt string renamed; outstanding mock-pay tokens (10-minute life) are invalidated by design |
| PWA cache | `public/sw.js` | cache version `kwaravend-v3` (old cache is dropped on next visit) |
| Fraud/moderation | `packages/shared/src/fraud.ts` + tests | impersonation patterns now match "Kwaravend support" etc. |
| AI prompts | `packages/ai/src` | brand name and hashtag in generated copy |
| Admin console (separate app) | `apps/admin/src` + README | all visible brand strings |
| Docs | `README.md`, root `package.json` description | renamed |

## Deliberately unchanged

| Item | Why |
| --- | --- |
| Deployed URLs `naijacart-roan.vercel.app`, `naijavend-admin.vercel.app` | These are live infrastructure identifiers. Changing the string breaks API calls and admin links until Vercel projects are renamed. |
| `packages/shared/src/traffic.ts` + its test (matches `naijacart*.vercel.app`) | Classifies traffic as registered automatically. own traffic: the regex must match the real Vercel hostnames or analytics counts every visitor as a referral. Update it together with the Vercel project rename. |
| `apps/admin/.vercel/project.json` (`naijavend-admin`), root `.vercel/repo.json` (`naijacart`) | Vercel project names — owner action, not a code edit. |
| `scripts/e2e_*.js` | They target the live deployed URL and seeded QA accounts. Renaming breaks the tests. |
| `apps/naijapay` | Deleted — it was a demo wallet contradicting the "no payments" rule, and carried invented stores. |
| `HANDOFF.md`, `BUG_AUDIT_AND_ROADMAP.md` | Dated session records. Rewriting them would falsify history; they are documentation, not product surfaces. |
| Repo folder name `naijavend` | Local checkout path, not code. |
| `nv-` CSS class prefix | Internal abbreviation, not the old brand string; 909 references, no user-visible text. |

## Routes

No public path changed. `/s/<slug>` store URLs are untouched, so no redirects were required. The old `/` landing page still serves the landing page (no path change).

## Owner tasks (outside the codebase)

1. **Domain** — register `kwaravend.com` (and ideally `kwaravend.ng`); point it at the storefront Vercel project; set `NEXT_PUBLIC_SITE_URL`.
2. **Vercel projects** — rename `naijacart` → `kwaravend` and `naijavend-admin` → `kwaravend-admin`, then update `apps/admin/src/app/AdminConsole.tsx`'s `MARKETPLACE_URL` fallback and the scripts that reference the old URLs.
3. **Support contacts** — fill `BRAND.supportWhatsApp`, `BRAND.supportEmail` and `BRAND.socials`. The storefront currently renders **no** social icons rather than linking to unowned handles.
4. **Legal entity** — confirm `BRAND.legalEntity` wording in Terms/Privacy with the owner; this change only swapped the brand string.
5. **Admin console deploy** — the admin app's brand strings are updated but it must be redeployed separately (`cd apps/admin && vercel --prod`).
6. ~~**Retire or rename `apps/naijapay`**~~ — done: the app was deleted.

## Verification

```bash
grep -rn "Naijavend\|naijavend\|Naijacart\|naijacart" apps/storefront/src apps/storefront/public
# → no matches

cd apps/storefront && npx tsc --noEmit --incremental false
# → clean
```
