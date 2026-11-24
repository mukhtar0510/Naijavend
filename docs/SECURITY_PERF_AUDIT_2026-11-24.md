# Security and performance audit (24 Nov 2026)

Scope: `apps/storefront`, `packages/shared`, Supabase project `zxgffqkjjlonrtstkufv` (production).
Method: Supabase security and performance advisors, read-only SQL on policies, grants, triggers and functions, a scan of every API route, `pnpm audit --prod`, typecheck, tests and a production build.
Follows `docs/SECURITY_AUDIT_2026-11-22.md` and `docs/PAYOUT_CHECKOUT_AUDIT_2026-11-23.md`.

## Security

| # | Severity | Finding | Status |
|---|---|---|---|
| S0 | **Critical** | Sellers cannot confirm any payment. The `mint_digital_deliveries` trigger (runs when an order moves to `paid`) called `gen_random_bytes()` without its `extensions` schema, so every `pending -> paid` update failed with "function gen_random_bytes(integer) does not exist". Found by the rolled-back order test below. | Fix written: `20261124090000_fix_mint_digital_deliveries.sql`, verified inside a rolled-back transaction. **Not applied yet: needs your approval.** |
| S1 | High | A seller's own token could write `orders` and `order_items` directly through the database API (policy `orders_owner_all` plus full column grants): raise a buyer's total after checkout, set `payment_status` without the confirm function, or insert fake "paid" orders that unlock verified reviews. The status trigger only looked at `status`. | Fix written: guard triggers in `20261124100000_security_performance_hardening.sql` (direct writes may change `status` only; inserts and deletes go through checkout, POS and server functions). **Not applied yet: needs your approval.** |
| S2 | Medium | Staff could insert POS orders with any total through the old `orders_pos_insert` / `order_items_pos_insert` policies, bypassing `create_pos_order` pricing. | Same migration drops both policies. Not applied yet. |
| S3 | Medium | `trending_products` view ran with its creator's rights (advisor ERROR `security_definer_view`), so anyone could read per-listing order counts. | App now reads it on the server only (this commit). Migration switches it to `security_invoker` and revokes public access. Not applied yet. |
| S4 | Low | `confirm_order_payment` could mark a cancelled or refunded order as paid. | Migration adds the check. Not applied yet. |
| S5 | Low | Public endpoints `/api/map/store-preview` and `/api/delivery-options` had no rate limit. | Fixed in this commit (60 per minute per IP). |
| S6 | Low | Leaked password protection is off in Supabase Auth. | Owner action: Supabase dashboard → Authentication → Password security → turn on "Leaked password protection". |
| S7 | Info | `vector` extension lives in the `public` schema. | Left alone: moving it is risky for little gain. |
| S8 | Info | `pnpm audit --prod`: 95 advisories, all in the Expo seller app's build tools (react-native CLI, expo CLI). None reach the storefront or shared packages. | No storefront action. Update Expo when the seller app is next worked on. |

Checked and fine: `stores` plan, verification and example fields are guarded by `guard_store_plan`; staff listing edits are limited to stock by `guard_listing_staff_update`; the session refresh redirect only allows `/dashboard` and `/account`; security headers (CSP, HSTS, X-Frame-Options DENY) are set; the two `dangerouslySetInnerHTML` uses are JSON-LD with `<` escaped and the theme script; service-role routes all check a seller, buyer, admin or a signed token.

## Performance

| # | Finding | Status |
|---|---|---|
| P1 | 59 RLS policies call `auth.uid()` once per row (advisor `auth_rls_initplan`). | Migration rewrites them in place to call it once per query. Not applied yet. |
| P2 | 17 foreign keys without an index (alerts, chat, deliveries, staff and others). | Migration adds the indexes. Not applied yet. |
| P3 | Trending score (Discover, `/tags`, map preview) reads views and orders. | Cached for 5 minutes server-side (`lib/trending.ts`), so pages don't recompute it per request. |
| P4 | 19 unused indexes, 80 "multiple permissive policies" notices. | Left: tables are small and most indexes will be used as data grows. |

## Bugs fixed in this change

- Seller "Riders" and "Dispatch" pages were paid-plan only; they are now free for every seller.
- The Kwaravend rider add-on could be bought although no rider service runs; it is now "coming soon" everywhere and the request API returns 503.

## Order test inside a rolled-back transaction

Approved by the owner (option A). One SQL transaction briefly set `is_example = false` on `example-taiwo-road-kitchen`, ran the checks, then rolled everything back (the block ends in an exception, so nothing is kept). Only order-code numbers KV-1055 and KV-1056 were used up. Nothing was sent outside the database (the code has no order email, WhatsApp or push to send).

| Check | Result |
|---|---|
| `create_order_v2`, 2 x Jollof rice (₦3,500), cash on delivery | Order KV-1055, total ₦7,000, `pending` / `unpaid`, 1 order line, 1 rate-limit row |
| Same idempotency key again | Same order id, `replayed: true` |
| Stock (set to 10 for the test) | 10 -> 8 after the order |
| Seller marks paid (`pending -> paid`, payment `paid`) | **Failed**: `function gen_random_bytes(integer) does not exist` (S0). With the fix applied in a second rolled-back test: order KV-1056 became `paid` / `paid` |
| Seller cancels | Stock stayed 8: cancelling never restocks (fix in the hardening migration) |
| Quantity 60 | Refused (`BAD_QUANTITY`) |
| Seller notifications from the database | 0 alert rows, 0 events. Sellers are still not notified of new orders (see the 23 Nov audit, section 3) |
