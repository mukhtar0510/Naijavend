# T00 — Repo audit

Date: 17 November 2026. Scope: the product as it exists in this repo, checked against the landing page.

## 1. Stack

| Layer | Reality |
| --- | --- |
| Monorepo | pnpm workspaces (`apps/*`, `packages/*`), root `vercel.json` builds the storefront |
| Main app | `apps/storefront` — Next.js 14 App Router, React 18.3, TypeScript 5.6 |
| Styling | Hand-written CSS modules in `src/styles/*.css` (base → chrome → components → interactions → admin → mobile → brand → marketplace-v2 → tailwind). Tailwind 3 + shadcn-style primitives in `src/components/ui` |
| Other apps | `apps/admin` (separate Next.js admin console), `apps/seller` (Expo) — not part of the T01+ build target. The old `apps/naijapay` demo wallet was deleted. |
| Shared packages | `packages/shared` (types, brand tokens, geo, hours, rankings, validation), `packages/ai` (listing/store draft logic) |
| Data layer | Supabase Postgres via `@supabase/supabase-js`. 33 SQL migrations in `supabase/migrations`. Two clients: `supabaseAnon()` for public reads, `supabaseService()` for server routes |
| Auth | Supabase Auth password + Google OAuth. Separate cookie pairs for sellers (`idev_access_token` / `idev_refresh_token`) and buyers (`idev_customer_token` / `idev_customer_refresh_token`). Admin gate in `src/lib/admin.ts` via `ADMIN_EMAILS` allow-list |
| Map | Leaflet 1.9 + OpenStreetMap tiles, wrapped by `src/lib/mapFactory.ts`; interactive locator in `src/components/StoreMap.tsx`, store-page embed in `MapEmbed.tsx` |
| Hosting | Vercel. Storefront build `pnpm --filter @idevtenancy/storefront build`. Supabase hosts DB/storage |
| Payments | **No gateway.** `POST /api/mock-pay` is a stand-in that marks an order `paid` when given an HMAC token minted by `create-order`. Its own comment says production would hand off to Paystack. No Paystack/Flutterwave SDK or key exists |

## 2. Routes (storefront)

Public marketplace (`(marketplace)` group, shared header/footer):
`/` (brand landing), `/home` (marketplace home), `/discover`, `/search`, `/rankings`, `/about`, `/faq`, `/legal`, `/legal/{terms,privacy,cookies}`, `/offline`, `/checkout/[orderId]`.

Buyer account: `/account`, `/account/{profile,chats,bookings,alerts,ai,ai/assistant}`; sign-in at `/account/signin`.

Seller console: `/dashboard`, `/dashboard/{listings,orders,bookings,chat,pos,analytics,ratings,staff,settings,ai,onboarding}`; sign-in at `/dashboard/signin`.

Public store sites: `/s/[slug]`, `/s/[slug]/catalogue`, `/s/[slug]/listing/[id]`, `/s/[slug]/order/[listingId]`, `/s/[slug]/book/[listingId]`, `/s/[slug]/chat`, `/s/[slug]/rate`. Kept outside the marketplace shell so each store reads as its own site.

Platform admin: `/admin` (single console). API: ~45 route handlers under `src/app/api/*` (AI, chat, listings, orders, bookings, POS, admin, discover, reports, disputes, onboarding, tracking).

## 3. Data model (actual tables)

Core: `stores`, `listings`, `orders`, `order_items`, `bookings`, `store_ratings`, `ai_usage_log`, `whatsapp_settings`.
Store layer: `store_themes`, `store_locations`, `store_staff`, `store_events`, `store_follows`, `store_reports`, `store_rating_stats`.
Commerce extras: `discount_codes`, `digital_deliveries`, `disputes`, `referral_codes`, `referrals`, `alerts`.
Ops: `chat_messages`, `chat_read_state`, `onboarding_funnel_events`, `admin_audit_log`, `banned_users`, `moderation_flags`.

Notable columns:
- `stores`: `slug` (unique), `category`, `business_type`, `business_hours` jsonb, `delivery_info` text, `delivery_options` jsonb (`pickup|rider|courier` + `fee_kobo`), `is_dropshipper`, `verification_status`, `plan` (`free|growth`), `latitude/longitude`, `social_links`.
- `listings`: `price_kobo`, `stock` (nullable), `compare_at_kobo`, `image_urls` jsonb, `video_url`, digital file fields, `type` (`product|service`).
- `orders`: `total_kobo`, `status` constrained to `pending|paid|fulfilled|cancelled|refunded`, `payment_reference`, `delivery_method`, `delivery_fee_kobo`, `discount_code`, `discount_kobo`, `channel`.
- `bookings`: overlap-exclusion constraint prevents double booking.

`create_order_atomic` RPC creates order + items + stock decrement + promo increment in one transaction. A DB trigger blocks authenticated users from setting `status='paid'`; only the service role can.

Stored procedures/triggers of note: atomic stock decrement, order-status transition guard, `set_updated_at`.

## 4. Auth in detail

- Seller and buyer sessions are separate cookie pairs in the same Supabase project.
- Refresh tokens are 30 days, sliding; access tokens 1 hour. Refresh-token-only sessions are re-minted.
- `getSellerClient()` re-validates the seller; `getCustomerUser()` resolves the buyer.
- Admin (`src/lib/admin.ts`) requires a Supabase session whose email is in `ADMIN_EMAILS`, and writes to `admin_audit_log`.
- RLS is enabled by `20260911000002_enable_rls.sql`; service-role operations live in server routes only.

## 5. Map

- `mapFactory.ts` centralises OpenStreetMap tiles, light/dark tile filter, and map options. No API key required.
- `StoreMap.tsx` renders the locator: category chips, open-now, search, list + map sync, user location via browser geolocation (`useViewerLocation`), **city selector with quick cities (Lagos default)**, haversine distance and OSRM routing with a straight-line fallback.
- `MapEmbed.tsx` renders a single store pin plus branch pins and a directions link.
- Store coordinates are stored in `stores.latitude/longitude`; there is **no area field and no bounding box**.

## 6. Feature status: implemented vs. claimed

| Claim on landing page / docs | In the code? | Notes |
| --- | --- | --- |
| Store sites at `/s/<slug>` with catalogue | **Yes** | Store page, catalogue, listing detail |
| Orders | **Partly** | Orders exist and are created server-side with price/stock checks, but the only completion path is the mock payment token; no manual payment confirmation, no delivery statuses |
| Bookings with no double-booking | **Yes** | DB exclusion constraint + booking flow |
| Free POS | **Yes** | `/dashboard/pos`, `/api/pos/charge` |
| Staff logins | **Yes** | `store_staff`, `/dashboard/staff` |
| Branches (multi-location) | **Yes** | `store_locations`, gallery on store page |
| Live map locator | **Yes** | Leaflet + OSM; **but centred on Lagos, not Ilorin**, and has a city picker |
| Verified blue tick | **Yes, but rule is fixed in code** | Awarded server-side on review thresholds; no admin revoke UI in storefront |
| Reviews from real orders/bookings | **Partly** | `store_ratings` has optional `order_id`/`booking_id`; enforcement is in the submit route, not a DB constraint |
| Rankings weighted by recency | **Yes** | `packages/shared/src/rankings.ts`, `store_rating_stats` |
| "Location never leaves your browser" | **Mostly** | `useViewerLocation` keeps coords client-side; delivery/manual addresses are text |
| Chat + WhatsApp handoff | **Yes** | `chat_messages`, click-to-chat links |
| Discount codes | **Yes** | Server-validated, usage counted atomically |
| Digital downloads | **Yes** | Tokenised download route |
| Disputes | **Yes** | `disputes` + seller respond route |
| Dropshipper mode | **Yes** | Flag on store + listing copy; not gated |
| AI store/listing drafts | **Yes** | `packages/ai`, Gemini with dummy fallback |
| Delivery fee by zone | **No** | Only a flat per-method fee per store (`pickup|rider|courier`) |
| Delivery tracking / riders | **No** | There is a `/api/track` route and `OrderShare`, but no `deliveries`/`riders`/`delivery_events` tables |
| Cart | **No** | Order form is single-listing (`/order/[listingId]`); no persisted multi-item cart UI |
| Referrals | **Yes** | `referral_codes`, `referrals`, `ReferralCard` |
| Analytics dashboard for sellers | **Yes** | `/dashboard/analytics`, `src/lib/insights.ts` |
| Platform admin metrics | **Party** | Counts users/stores/listings/orders; **no event-based weekly-active or delivery metrics** |
| Plans and gating | **No real gating** | `stores.plan` only allows `free|growth`; no `hasFeature()` helper |
| "0% commission" | **Yes** | No commission code or gateway |
| Demo store labelled as demo | **No** | Landing page renders fake store data (`Amaka Glow Studio`, ₦28,000 order, 4.6★/38 reviews, "Sent on WhatsApp") with no "sample data" label. This is the biggest honesty gap |

### Broken / misleading UI found

- Landing stat counters render `0`, `24/7`, `1`, `5` — the "5 Layers in one storefront" and "1 Link…" cards read as "0 Link…" / "0 Layers…" in the DOM depending on animation state.
- Landing hero says "Every Nigerian business…" while there is no coverage beyond the map's city picker; no city is actually seeded.
- `/discover` defaults the map to Lagos (`DEFAULT_CENTER`), and the quick-city list offers Lagos, Abuja, Port Harcourt etc.
- The `Order · NV-1042` sample in the landing hero implies an order-prefix scheme that the app does not generate (orders use raw UUIDs).
- `mock-pay` + checkout copy invite the buyer to "Pay ₦…" even though no money moves.

## 7. Gaps that block the BUILD.md plan

1. **No `areas` table** and no Ilorin seed — needed by T07/T08.
2. **No cart** — `create-order` accepts multiple lines, but no client cart, no persistence, no drawer.
3. **No payment status track** — `orders.status` mixes fulfilment and payment. Need separate `payment_status` and `payment_method`.
4. **No rider/delivery tables** — T09 needs `riders`, `deliveries`, `delivery_events`.
5. **No feature-flag module** — dropshipper/rankings/multi-branch are always on.
6. **No event taxonomy** — only `store_events` + `onboarding_funnel_events`; T10's event list is not implemented.
7. **No plan gating** — `plan` is a two-value enum with no enforcement.
8. **No city/area concept** — `stores.category` exists, `stores.address` is free text.

## 8. Verification commands available

```bash
cd apps/storefront && npx tsc --noEmit --incremental false
cd apps/storefront && pnpm build
cd apps/admin && npx next build
```

No test runner is configured for the storefront; `packages/shared` has vitest tests.

## 9. Bottom line

The storefront is a real, working product with a strong store-page and seller-dashboard base. It is **not** the product the landing page describes: the marketplace is Lagos-centred with no area model, order status conflates payment and fulfilment, there is no cart, no delivery tracking, and the demo data is unlabelled. The BUILD.md order (audit → rename → honest page → flags → order/payment model → cart → map locked to Ilorin) correctly starts by fixing the story before adding the new machinery.
