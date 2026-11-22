# INFRA_STATE.md (Task I0)

Date: 22 November 2026. Read-only survey for INFRASTRUCTURE.md. Nothing in the app or database was changed to produce this file.

Sources: the live Supabase project `idevtenancy` (ref `zxgffqkjjlonrtstkufv`, Postgres 17, eu-west-2), the Vercel project `naijacart` (env var names only, no values read), and the repo at commit `5812cea` plus the uncommitted working tree.

## 1. Conflicts with INFRASTRUCTURE.md (decide before I1)

| # | INFRASTRUCTURE.md says | What is actually true | Impact |
|---|---|---|---|
| C1 | "RLS is on for all 31 public tables" | 43 public tables, all with RLS on | None, just a stale count |
| C2 | `create_order_atomic` is "public on purpose (guest checkout)" | `anon` **cannot** execute it. `authenticated` **can**. Guest checkout works because `/api/create-order` calls it with the service role | **Real hole, today:** any signed-in user can call `POST /rest/v1/rpc/create_order_atomic` directly with `p_total_kobo = 1`, any `p_discount_kobo`, and any `p_customer_id` (attributing an order to another person). Stock is decremented, so this can also be used to drain stock. I1 fixes it |
| C3 | Client sends total, discount, fee | `/api/create-order` already recomputes subtotal, discount and delivery fee on the server from `listings`, `discount_codes` and `stores.delivery_options`. Only the RPC itself trusts its arguments | I1 moves that calculation into the database function so the route and POS share one source of truth |
| C4 | Idempotency key returns the same order | Exists, but only as an **in-memory** `Map` in the route (per Vercel instance, lost on cold start) | Not reliable on serverless. I1 needs an `idempotency_key` column with a unique index |
| C5 | Rate limit per IP and per phone | In-memory limiter (`lib/ratelimit.ts`), per IP only, per instance | Same serverless weakness. I1 should add a DB-backed check for phone (and IP) |
| C6 | Order code `KV-1042` | No order code exists. The buyer sees `/checkout/<order uuid>` | New column + sequence in I1 |
| C7 | Tracking link `/track/<token>` | Exists, but only for orders that create a `deliveries` row (rider, courier, zone). Pickup orders get no tracking token | Decide: give every order a token (I1) or keep delivery-only |
| C8 | Discount "minimum order if any" | `discount_codes` has no `min_order_kobo` column. Columns: `code, percent_off, active, usage_count, max_uses, zone_id` | Either add the column in I1 or drop the requirement |
| C9 | "Never store the full account number" (payout accounts) | `store_bank_accounts` stores the **full** `account_number` (0 rows today). It exists so buyers can see where to transfer for manual payments | Not a conflict for manual transfer (the buyer needs the number). The new `seller_payout_accounts` (I2) keeps last 4 only. Keep the two tables separate. Owner: confirm |
| C10 | KWARAVEND_UPDATES.md section 5.5 has email templates; KWARAVEND_AUTH_EMAILS.md has auth templates | **Neither file is in the repo.** Only `docs/KWARAVEND_IMPROVEMENTS.md` and `docs/KWARAVEND_REBRAND_CHANGES.md` exist | Owner: add them, or I5 writes plain templates for approval |
| C11 | No WhatsApp API, click-to-chat only | `/api/ai/whatsapp-send` calls the **WhatsApp Cloud API** (graph.facebook.com) when `WHATSAPP_TOKEN` is set. It sends an AI image to the seller's own number. Env var is not set in Vercel, so it is dormant | Owner: keep dormant, or remove in I7. It must not be described as order notifications |
| C12 | `ONLINE_PAYMENTS_ENABLED` / `PAYMENTS_ENABLED` | `lib/flags.ts` has a hard-coded `ONLINE_PAYMENTS_ENABLED = false` and `lib/payment-provider.ts` has a manual provider plus a seam for Paystack | I2/I3 replace the constant with the `PAYMENTS_ENABLED` env flag via `config/env.ts` |
| C13 | `SITE_URL` is the site URL | Vercel has both `SITE_URL` (production) and `NEXT_PUBLIC_SITE_URL` (production). **Code reads only `NEXT_PUBLIC_SITE_URL`** | Harmless. `config/env.ts` should read one name (suggest `NEXT_PUBLIC_SITE_URL`, falling back to `SITE_URL`) |
| C14 | Supabase Realtime for dashboard alerts | The `supabase_realtime` publication has **no tables**. No code subscribes to anything | I5 adds `orders` (or the outbox) to the publication |
| C15 | Cron via Vercel or pg_cron | `pg_cron` is **not installed**. `vercel.json` has no `crons`. Vercel plan was not readable through the API | Owner: confirm the Vercel plan. On Hobby, crons run at most once a day, which is too slow for 5 to 15 minute jobs. Options: Pro plan, or enable `pg_cron` + `pg_net` in Supabase to call the protected endpoints |
| C16 | "lint, types, tests, build" after each task | No ESLint config or `lint` script anywhere. Tests (vitest) exist only in `packages/shared` and `packages/ai`. The storefront has **no tests** | I1 adds vitest to the storefront for the route and an SQL test script. Lint: add `next lint` config, or skip and say so |
| C17 | Migration history | Remote has `20261122142901_security_hardening`; the repo file is `20261124000000_security_hardening.sql`. Same content name, different version | `supabase db push` would try to apply it again. Rename the local file to match before the next migration |
| C18 | `SUPABASE_SERVICE_ROLE_KEY` | Set in Vercel for **production only**. Preview deployments have no service key, so checkout fails on previews | Owner: add it to Preview too if previews are used for testing |

## 2. Tables (43, all RLS on)

Policies in brackets. Tables with 0 policies are server-only (service role).

admin_audit_log [0], ai_usage_log [2], alerts [3], banned_users [0], bookings [2], chat_messages [3], chat_read_state [1], customers [2], deliveries [1], delivery_events [1], delivery_secrets [0], digital_deliveries [1], discount_codes [4], disputes [4], listings [3], map_events [0], moderation_flags [0], onboarding_funnel_events [1], order_items [4], orders [4], plan_payments [1], platform_events [0], platform_settings [0], referral_codes [2], referrals [2], rider_requests [1], riders [1], saved_stores [2], seller_waitlist [0], store_bank_accounts [1], store_customer_notes [1], store_domains [2], store_events [2], store_follows [1], store_locations [2], store_rating_stats [1], store_ratings [2], store_reports [4], store_staff [2], store_themes [2], stores [2], support_tickets [1], whatsapp_settings [2].

Views: users_overview, trending_products (SECURITY DEFINER, advisor ERROR), store_events_daily, store_referrer_daily, store_sales_daily, platform_activity_daily.

Row counts that matter: **orders 0**, order_items 0, store_bank_accounts 0, stores 4 (all `verification_status = 'unverified'`), listings 17, customers 14, map_events 31 (still being written, so it works through the service role).

Extensions: plpgsql, btree_gist, pgcrypto, uuid-ossp, pg_stat_statements, supabase_vault, **vector in public**. No pg_cron, no pg_net.

## 3. Orders and payments: values in use

`orders` has 0 rows, so no stored values. Allowed values (CHECK constraints):

- `status`: pending, paid, fulfilled, cancelled, refunded
- `payment_status`: unpaid, awaiting_confirmation, paid, refunded, failed (failed and refunded already exist)
- `payment_method`: '', cash_on_delivery, bank_transfer, pay_on_pickup, other (**no `paystack` yet**, I3 adds it)
- `total_kobo` is `bigint`, `>= 0`. `discount_kobo >= 0`. Phone `^\+?[0-9]{7,15}$`. Drop pin limited to the Ilorin box.

Columns: id, store_id, customer_name, customer_phone, total_kobo, status, payment_reference, created_at, updated_at, customer_id, discount_code, discount_kobo, pos_staff_id, channel, delivery_method, delivery_fee_kobo, payment_status, payment_method, payment_proof_url, payment_confirmed_at, delivery_zone, delivery_area, delivery_address, delivery_landmark, delivery_note, drop_lat, drop_lng. (`payment_reference` exists already and is unused.)

Triggers on orders: trg_guard_order_status (guard_order_status_transition), trg_alert_order_status, trg_mint_digital_deliveries, trg_orders_updated.

`guard_order_status_transition` lets **any service-role write through unchecked** (`if auth.uid() is null then return new`). Seller moves: pending to cancelled; pending to paid only when payment_status is paid; paid to fulfilled, cancelled, refunded; fulfilled to refunded, cancelled. Final states are only enforced for sellers, not for server code. INFRASTRUCTURE.md 4.2 wants final states enforced in the database for everyone; that is a behaviour change for I1 or I3.

## 4. Order and payment functions (live grants)

| Function | Security | anon | authenticated | Notes |
|---|---|---|---|---|
| create_order_atomic(11 args) | definer | no | **yes** | Trusts total, discount, fee and customer id. See C2 |
| decrement_listing_stock(uuid, int) | invoker | no | yes | Runs under the caller's RLS, so a buyer cannot change someone else's listing. Low risk, but should be revoked from authenticated once only the RPC calls it |
| confirm_order_payment(uuid, text) | definer | no | yes | Checks store owner = auth.uid(). Intended |
| attach_payment_proof(uuid, text) | definer | no | yes | Checks customer = auth.uid(). Guest buyers (no customer_id) cannot attach proof; the `/api/orders/proof` route handles that |
| guard_order_status_transition | invoker | yes | yes | Trigger function, not callable usefully. Harmless |

## 5. Existing routes that touch orders, payments, notifications

- `POST /api/create-order`: guest and signed-in checkout (described above). Returns orderId, totals, payToken, trackingToken.
- `POST /api/pos/charge`: POS orders, also calls create_order_atomic.
- `POST /api/orders/payment`: seller confirms a manual payment.
- `POST /api/orders/proof`: buyer uploads a transfer receipt.
- `POST /api/orders/transition`: seller moves order status.
- `POST /api/mock-pay`: disabled unless `MOCK_PAY_ENABLED=true` and not production. Leave it; delete when I3 lands.
- `GET /api/checkout-summary`, `/api/validate-promo`, `/api/delivery-options`, `/api/discounts`.
- `/api/track`, page `/track/[token]`: delivery tracking (delivery orders only).
- `/api/dashboard/bank`: manages `store_bank_accounts` (manual transfer details).
- `/api/disputes`, `/api/disputes/respond`, `/api/reports/store`: buyer protection pieces that already exist.
- `/api/verification/apply`, `stores.verification_status`, `verified_at`: an existing verification flow. I6 must reconcile its badge wording with "Basic / Payout verified / Reviewed".
- `/api/admin/*` and `/admin` pages, gated by `ADMIN_EMAILS`; `admin_audit_log` columns: id, actor_email, action, target_email, target_user_id, details, created_at (no store_id column; I6 uses `details`).
- `lib/email.ts`: Resend sender, no-op without key. Only sends a welcome email today. There is no `EMAIL_ENABLED` check yet.
- WhatsApp click-to-chat (`wa.me`) is already used in the track page, dashboard orders, customers, dispatch, riders, rider page, OrderShare, ShareBar and the full map. I7 is mostly an audit of the copy and number format.
- No `/api/health`, no `/api/paystack/*`, no `/api/pay/*`, no cron endpoints, no `config/env.ts`.

## 6. Environment variables

Vercel `naijacart` (names only):

| Name | Targets | Used by code |
|---|---|---|
| NEXT_PUBLIC_SUPABASE_URL | production | yes |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | production | yes |
| SUPABASE_SERVICE_ROLE_KEY | **production only** | yes |
| NEXT_PUBLIC_SITE_URL | production | yes |
| SITE_URL | production | **no** |
| RESEND_API_KEY | production, preview | yes |
| EMAIL_FROM | all | yes |
| EMAIL_REPLY_TO | all | **no** (I5 should use it) |
| PAY_TOKEN_SECRET | production, preview | yes |
| ADMIN_EMAILS | production, preview | yes |
| GEMINI_API_KEY | all | yes |

Not set and needed later: EMAIL_ENABLED, PAYMENTS_ENABLED, PAYSTACK_SECRET_KEY, NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY, CRON_SECRET.
Referenced in code but not set: MOCK_PAY_ENABLED (correct, keep unset), WHATSAPP_TOKEN, WHATSAPP_PHONE_ID, WHATSAPP_PHONE_ID_BY_STORE, GEMINI_MODEL, GEMINI_IMAGE_MODEL, GEMINI_EMBEDDING_MODEL, NEXT_PUBLIC_FLAG_*.

Service role key in client code: a grep shows it only in server files today. No automated test enforces that yet (I1 or I8 adds one).

## 7. Security advisor (baseline before I1)

- ERROR: `trending_products` is a SECURITY DEFINER view (I8).
- WARN: `vector` extension in public (leave, per INFRASTRUCTURE.md).
- WARN: authenticated can execute SECURITY DEFINER `attach_payment_proof`, `confirm_order_payment` (intended), and **`create_order_atomic` (not intended, C2)**.
- WARN: leaked-password protection off (owner).
- INFO: RLS on, no policies on admin_audit_log, banned_users, delivery_secrets, map_events, moderation_flags, platform_events, platform_settings, seller_waitlist (server-only, fine).

I1 is "advisor clean" when the `create_order_atomic` warning is gone and nothing new appears.

## 8. Other apps

- `apps/admin` (Next.js) and `apps/seller` (Expo) exist. Neither is deployed by `vercel.json`, which builds only the storefront. The storefront's `/admin` and `/dashboard` are what production uses.

## 9. Proposed I1 plan (needs owner approval because it changes the live database)

There is one Supabase project, and it is production. There are 0 orders, so the data risk is low, but the function change is live the moment it is applied.

1. Rename the local migration file to match the remote version (C17).
2. New migration `i1_server_calculated_orders`:
   - `orders.order_code text unique` (`KV-` + sequence starting at 1001), `orders.idempotency_key uuid unique`, `orders.tracking_token text unique` for every order (if C7 is approved).
   - `discount_codes.min_order_kobo integer` (if C8 is approved).
   - `create_order_v2(p_store_id, p_items jsonb, p_delivery_method, p_delivery_zone, p_discount_code, p_customer_name, p_customer_phone, p_idempotency_key, ...)`: prices from `listings` (active, same store, product type), fee from `stores.delivery_options`, discount validated in the function, `customer_id := auth.uid()` when called by a signed-in user (the service-role route passes the verified user id through a server-only argument), qty 1 to 50, max 30 lines, stock decrement in the same transaction, same idempotency key returns the same order, per-phone and per-IP limits from a small `order_rate_limits` table.
   - Grant execute on `create_order_v2` to anon and authenticated, as INFRASTRUCTURE.md asks. Revoke `create_order_atomic` from authenticated (closes C2) once `/api/create-order` and `/api/pos/charge` use v2.
3. Update both routes to call v2 and display only what it returns.
4. Tests: an SQL test script (wrong total ignored, two parallel orders for the last unit, repeated idempotency key) run against the database, and vitest for the route input schema.
5. Re-run the security advisor and report.

## 10. Owner actions found in this survey

- Confirm the Vercel plan and how often crons may run (C15).
- Add the missing KWARAVEND_UPDATES.md and KWARAVEND_AUTH_EMAILS.md, or approve plain templates (C10).
- Decide on the dormant WhatsApp Cloud API route (C11).
- Add `SUPABASE_SERVICE_ROLE_KEY` to Preview if previews are used for testing (C18).
- Approve applying the I1 migration to the live project (section 9).
- Still open from INFRASTRUCTURE.md section 13: Paystack test keys, fee bearer, leaked-password protection, backups.
