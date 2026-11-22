# Build status against the docs

Updated 22 November 2026. "Done" means built and type-checked; anything that
needs a signed-in seller or real orders to test is marked "built, not tested
live". Sources: BUILD.md (work order), KWARAVEND_IMPROVEMENTS.md, REDESIGN.md,
REDESIGN_V2.md, KWARAVEND_REBRAND_CHANGES.md.

## BUILD.md tasks

| Task | State | Notes |
| --- | --- | --- |
| T00 audit | Done | docs/AUDIT.md (+ V0 addendum) |
| T01 rename | Done | Kwaravend everywhere; live on kwaravend.ng. Old Vercel names/URLs and the Expo `slug`/`scheme` kept on purpose (renaming breaks links) |
| T02 honest landing | Done | Locked hero copy (KWARAVEND_REBRAND_CHANGES R1), labelled example storefront, claims audit |
| T03 flags | Done | `lib/flags.ts`; owner Flags panel in /admin (read-only: flags are env vars) |
| T04 orders + payments | Done | Separate order/payment status, manual methods, seller confirms, `PaymentProvider` seam with only the manual provider |
| T05 cart | Mostly | 4-step checkout, per-store cart, server totals, idempotency, delivery pin, 30-day expiry. **Not yet:** cart sync to a signed-in account, "Only 3 left" in the cart |
| T06 onboarding | Done | Checklist now includes hours, bank details and delivery choice |
| T07 map | Done | MapLibre, Ilorin lock, 36 areas (most centres approximate, owner to check), logo pins, heat, tilt, directions, sheet. Pins outside Ilorin rejected; **seller waitlist** at /waitlist. **Not yet:** a written OSM coverage check per area |
| T08 zones + fees | Done | Rider/courier/campus zones, server-side fees, Ilorin areas required |
| T09 tracking | Built, not tested live | Riders, dispatch board, /track and rider links, handover code, failure reasons. **Not yet:** photo proof of delivery |
| T10 analytics + admin | Built, not tested live | Event taxonomy (`platform_events`), admin Growth panel: weekly active, setup, retention, orders, deliveries, areas, waitlist |
| T11 plans + gating | Done | `hasFeature()` + locked states; gating is **off** (`NEXT_PUBLIC_FLAG_PLAN_GATING`) until plans are on sale |
| T12 CRM + analytics | Done | Customer drawer, notes, exports; delivery analytics |
| T13 trust | Mostly | Store reports queue + blue-tick grant/revoke in /admin (audited). **Not yet:** reporting a review, DB-level "review needs an order" constraint |
| T14 hardening | Partly | See docs/HARDENING.md. **Not yet:** Playwright tests, Lighthouse CI, error tracking |

## REDESIGN_V2 steps

| Step | State |
| --- | --- |
| V0 audit | Done |
| V1 foundation | Done except migrating ~240 raw `<button>`s and the raw-hex lint rule |
| V2 shells | Done: bottom nav, phone menu with seller login, area dropdown |
| V3 `/` | Hero rebuilt; 100-layer scene kept from R3. WebGL models wait for the owner's 3D decision |
| V4 `/home` | Done (SVG diorama on every tier) |
| V5 map | Done (500-store load test not run) |
| V6 seller dashboard | Partly: CRM, dispatch, riders, analytics. **Not yet:** the "Today" home redesign with KPI sparklines and a hero chart |
| V7 buyer flows | Checkout + tracking done. **Not yet:** product gallery redesign |
| V8 public pages | **Not yet:** /about, /faq, auth and 404 redesigns |
| V9 hardening | **Not yet** |

## Needs the owner

1. Supabase → Authentication → URL Configuration: add `https://kwaravend.ng` (Site URL + Redirect URLs).
2. Legal text: refunds, cancellations, delivery tracking and location handling in Terms/Privacy (the app shows plain how-it-works notes, not legal terms).
3. Check the approximate Ilorin area centres in `apps/storefront/src/lib/ilorin.ts`.
4. Plans: the app has four tiers; the rebrand file lists three ("Starter"). Decide before merging tiers.
5. 3D models (WebGL): built in code, supplied, or skip.
