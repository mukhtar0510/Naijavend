# Payout, checkout and seller-notification audit (23 Nov 2026)

Scope: `apps/storefront` (Next.js 14), Supabase project `zxgffqkjjlonrtstkufv` (production), migrations up to `20261123100000_plan_features.sql`.
Method: code reading, read-only SQL against production (policies, grants, triggers, function bodies, row counts), and mock checkouts in the local preview (`.claude/launch.json` → `storefront`, which talks to the production database).

Screenshots are in [`docs/checkout-audit/`](checkout-audit/).

## Summary

- **There is no payout system, by design.** Buyers pay sellers directly (cash on delivery, bank transfer, pay on pickup). Kwaravend never holds money, so there is no payout ledger, no settlement, no platform fee. The payment-provider seam (`lib/payment-provider.ts`) only has a manual provider; `ONLINE_PAYMENTS_ENABLED = false`.
- **Money correctness at order creation is solid.** `create_order_v2` prices every line, the delivery fee and the discount in the database; the browser sends ids and quantities only. Idempotency keys, per-phone/per-IP rate limits, locked stock decrements and the example-store block all work.
- **Sellers are not told about new orders.** No email, no WhatsApp, no push, no alert. A seller only finds out by opening the dashboard. The buyer is told "The seller has been given your order", which overstates it.
- **4 clear bugs fixed in this change** (phone format on direct order and booking, booking time zone, missing delivery address on the direct order page). Database-side issues are listed with proposed migrations but **not applied** (they need the owner's go-ahead).
- Production currently has **0 orders, 0 bookings, 0 seller bank accounts, 0 digital listings**, so nothing below has been exercised by real buyers yet.

## 1. How sellers get paid

| Piece | Where | What it does |
|---|---|---|
| Payment methods | `lib/payments.ts` | `cash_on_delivery`, `bank_transfer`, `pay_on_pickup` for buyers; `other` for POS. Status: `unpaid → awaiting_confirmation → paid / refunded / failed`. |
| Provider seam | `lib/payment-provider.ts` | Manual provider only. `verify()` always `pending`, `refund()` always "seller refunds directly", no webhook. |
| Seller's bank details | table `store_bank_accounts` (owner-only RLS) | Shown on the buyer's order page only for bank-transfer orders and only to the holder of the private pay link (`?pt=`). |
| Pay link token | `lib/paytoken.ts` | HMAC over the order id, keyed from `PAY_TOKEN_SECRET` or the service-role key. Unlocks bank details, receipt upload and digital downloads. |
| Buyer receipt upload | `attach_payment_proof()` + `/api/orders/proof` | Moves `payment_status` to `awaiting_confirmation`. |
| Seller confirms money | `/api/orders/payment` → `confirm_order_payment()` | Owner-only (checked in the function). Sets `payment_status = paid`, and `status pending → paid`. |
| Mock pay | `/api/mock-pay` | Off unless `MOCK_PAY_ENABLED=true` and not production. Not set locally; verified it returns 404. Nothing in the UI calls it. |
| POS | `/api/pos/charge` → `create_pos_order()` | Owner or active staff; prices from listings; records the sale as paid. |
| Plan billing | `lib/billing.ts` | Seller subscription plans, not buyer money. Out of scope. |

### What works

- Server-side pricing (`create_order_v2`, `create_pos_order`): totals, fees and discounts come only from the database; quantity 1–50 per line, max 30 lines; discount needs an active paid plan, honours max uses, zone and minimum order; last discount use is re-checked under the update.
- Idempotency: the same `idempotency-key` returns the same order (also under a concurrent insert race via the unique index). Both cart and direct-order pages make one key per checkout and keep it across retries.
- Rate limits: 10/min per IP in the route, 5 orders per phone and 20 per IP per 10 minutes in the database (hashed buckets).
- Who can mark an order paid: only the store owner through `confirm_order_payment`, or the service role. The trigger `guard_order_status_transition` blocks a signed-in user from `pending → paid` unless `payment_status = paid` in the same write.
- Bank details and receipts are not exposed to someone who only has the order id.
- Double booking is blocked by an exclusion constraint on `bookings`.

### Risks found (not money-losing today, because no money passes through Kwaravend)

| # | Severity | Finding |
|---|---|---|
| R1 | High (integrity) | **Sellers can write `orders` directly.** Policy `orders_owner_all` (ALL) plus a full column `UPDATE` grant lets a store owner, through the public API with their own token, insert orders with any status/total and change `total_kobo`, `discount_kobo`, `payment_status`, `customer_phone` on existing orders. The guard trigger only looks at `status` on UPDATE; it never runs on INSERT. Effects: a seller can raise a buyer's total after the order is placed (the buyer's order page shows the new total), and can fabricate "paid" orders with any phone number, which `/api/submit-rating` accepts as proof of purchase for a verified review and which feed analytics. Same for `order_items` (`order_items_owner_all`). |
| R2 | Medium | **Staff can insert POS orders directly** with any `total_kobo >= 0` (`orders_pos_insert`, `order_items_pos_insert`), bypassing `create_pos_order` pricing. The route no longer needs these policies. |
| R3 | Medium | **Cancelling never returns stock.** `create_order_v2` decrements stock, but no path (transition route, trigger or function) adds it back when an order is cancelled or refunded. A cancelled order permanently removes items from sale. |
| R4 | Low | `confirm_order_payment` has no status check: it can mark a cancelled or refunded order's `payment_status` as `paid`, and re-confirming overwrites `payment_confirmed_at`. Active staff cannot confirm payments (owner only), which may or may not be intended. |
| R5 | Low | No record of money going back: `refunded` exists as a status but nothing records who refunded, how much, or when. Fine while sellers refund in cash; needed before any gateway. |
| R6 | Info | No payout records exist because there are no payouts. If Paystack is added later, a payouts/settlements table, webhook event log (unique on provider event id) and refund ledger will be needed; the seam in `payment-provider.ts` is the right place. |

Proposed migration for R1/R2 (additive in effect, **not applied**, needs owner approval):

```sql
-- Sellers read and update their orders, but only through the order functions for money fields.
revoke update on public.orders from authenticated;
grant update (status, updated_at) on public.orders to authenticated;   -- transition route only writes status
drop policy if exists orders_owner_all on public.orders;
create policy orders_owner_read on public.orders for select using (exists (select 1 from stores s where s.id = orders.store_id and s.owner_id = auth.uid()));
create policy orders_owner_update on public.orders for update using (exists (select 1 from stores s where s.id = orders.store_id and s.owner_id = auth.uid()));
-- order_items: read-only for owners; inserts only via create_order_v2 / create_pos_order.
drop policy if exists order_items_owner_all on public.order_items;
create policy order_items_owner_read on public.order_items for select using (exists (select 1 from orders o join stores s on s.id = o.store_id where o.id = order_items.order_id and s.owner_id = auth.uid()));
drop policy if exists orders_pos_insert on public.orders;
drop policy if exists order_items_pos_insert on public.order_items;
```

Before applying, check every write to `orders` made with the seller's client. Found in this audit: `/api/orders/transition` and `/api/disputes/respond` (both write `status` only, so they keep working); `/api/orders/proof` and `mock-pay` use the service role. Re-check delivery and rider routes before applying. For R3, a `restock_order(order_id)` call inside the cancel/refund transition (service role or security definer) is the fix.

## 2. Checkout paths

Test rule used: production database, so orders were attempted only on example stores, which the database refuses (`EXAMPLE_STORE`). No order, booking or delivery rows were created. The only rows created were two analytics events in `platform_events` (`cart_item_added`, `checkout_started`, store `example-taiwo-road-kitchen`, 23 Nov 2026) from the browser run.

| Path | Code | Result in preview | Notes |
|---|---|---|---|
| Direct "Order" from a listing (`/s/[slug]/order/[listingId]`) | page → `/api/create-order` → `create_order_v2` | Reached the database and was refused with the example-store message ([02](checkout-audit/02-direct-order-example-store-blocked.jpg)). Before the fix, the phone typed in the page's own placeholder format (`+234 801 234 5678`) was rejected ([01](checkout-audit/01-direct-order-phone-rejected.jpg)). | Bugs B1, B3, B5, B6 below. |
| Store cart (`AddToCart` → `StoreCart` sheet, 4 steps) | `lib/cart.ts` (localStorage, preview prices) → `/api/create-order` | Cart, contact (local `0801...` number accepted), delivery, pay steps all worked ([03](checkout-audit/03-cart-pay-step.jpg)); order refused for the example store with a clear message ([04](checkout-audit/04-cart-example-store-blocked.jpg)). | Best of the paths: normalises phone, collects Ilorin area/address/pin, filters pay methods by delivery method. |
| Marketplace `/checkout/[orderId]` | `checkout-summary` | Not a cart; it is the post-order page (status, bank details for transfer, receipt upload, tracking). Could not be exercised end to end without an order row; `checkout-summary` with an unknown id returns 404 as expected. | |
| Booking (`/s/[slug]/book/[listingId]`) | page → `/api/create-booking` | Refused for the example store ([05](checkout-audit/05-booking-example-store-blocked.jpg)). | Bugs B2, B3. No deposit, no idempotency key (double booking still blocked by the constraint). |
| POS | `/api/pos/charge` → `create_pos_order` | Unauthenticated call returns 401. Not run signed-in (needs a seller session on a real store). | R2. |
| Digital "Buy & get download" | listing page links to `/order/...` | Not testable: no digital listings exist. By code, `create_order_v2` raises `NOT_ORDERABLE` for any non-product listing, so this button always ends in an error. | B4. |

End-to-end order creation, payment confirmation and notifications on a non-example store were **not** run, to avoid writing real rows to production. The parent session was asked how to proceed; see "Not verified".

## 3. Seller notifications

| Channel | Status | Detail |
|---|---|---|
| Email (`lib/email.ts`, Resend) | **Missing for orders** | Only `sendWelcomeEmail` exists, called from sign-up. No order or booking email. Also silently no-ops without `RESEND_API_KEY`/`EMAIL_FROM` (not set locally). |
| WhatsApp | **Missing (manual only)** | No automatic message. The seller's dashboard has a `wa.me` link to message the buyer. The buyer's `OrderShare` button opens WhatsApp with no recipient (and shows the uuid-based ref, not the `KV-` code). Nothing sends the order to the seller's WhatsApp. `whatsapp_settings` has 0 rows. |
| In-app alerts (`alerts` table, `/api/alerts`) | **Buyer-only** | Triggers `alert_order_status_change` / `alert_booking_status_change` write alerts for the **buyer** on status changes. Nothing is written for the seller, and nothing on order creation. |
| Push | **Missing** | No service worker, web push or realtime subscription in the codebase. |
| Events | Works (analytics only) | `order_created`, `order_confirmed`, `booking_created` go to `platform_events`. Nobody is notified from them. |
| Dashboard | Works (pull only) | Dashboard home shows "Orders to confirm" and "Booking requests" counts; `/dashboard/orders` is `force-dynamic`. The seller sees a new order only when they open or refresh the dashboard. |

Plainly: **no channel tells a seller that an order or booking has arrived.** The order confirmation copy ("The seller has been given your order") should either change or be backed by a real notification. The smallest real fix: on order/booking creation, (a) insert a seller-facing alert row (needs a `seller_id`/`store_id` alert type and a dashboard bell), and (b) send an email to the owner through `sendEmail` once Resend is configured; (c) give the buyer a "Send this order to the seller on WhatsApp" button on the confirmation page using the store's WhatsApp number (no API needed).

## 4. Bugs, ranked

| # | Severity | Bug | Status |
|---|---|---|---|
| B1 | High | Direct "Order" page offered rider/courier delivery but never asked for the Ilorin area or address, so `create-order` rejected every such order (`invalid_area`). | **Fixed**: area select, address and landmark fields appear when rider or courier is picked. |
| B2 | High | Booking time zone: the page sends the `datetime-local` value with no zone; the server parsed it in UTC (Vercel), so a 10:00 booking was stored as 11:00 Ilorin time. The account and dashboard booking lists also formatted times in the server's zone. | **Fixed**: zoneless slot values are read as WAT (+01:00); both booking lists format with `timeZone: 'Africa/Lagos'`. |
| B3 | High | Direct order and booking pages rejected normal Nigerian numbers (`0801...`, `+234 801 ...`), including the order page's own placeholder. Only the cart normalised them. Also the 16-character cut truncated spaced numbers. | **Fixed**: `normaliseNgPhone` in `@idevtenancy/shared` (with tests), applied on the server in `create-order` and `create-booking`; the cart uses the shared helper. |
| B4 | High | "Buy & get download" on digital listings leads to the order page, which always fails (`NOT_ORDERABLE`). Digital products cannot be bought. | Not fixed (product decision: either let `create_order_v2` accept digital listings, or hide the button). No digital listings exist yet. |
| B5 | Medium | Direct order page shows no product name, price or total before "Place order". | Not fixed. |
| B6 | Low | Direct order quantity allowed 999; the database caps at 50. | **Fixed**: input capped at 50. |
| B7 | Medium | Buyer confirmation says the seller "has been given your order" though no notification is sent (see section 3). | Not fixed (copy/product decision). |
| B8 | Low | "Order" buttons and the cart are shown on example stores; buyers fill the form before learning the store cannot take orders. | Not fixed. |
| B9 | Low | `OrderShare` uses `orderRef(orderId)` instead of the `KV-` order code. | Not fixed. |
| R1–R5 | see section 1 | Database permission and stock issues. | Need a migration and owner approval. |

## Not verified

- A full order on a non-example store (creation → seller confirms payment → buyer alert → digital minting) was not run, because it would write real rows to production. Options: a Supabase branch, a transaction that is rolled back, or a clearly named test store the owner approves.
- POS signed in, receipt upload, and the payment confirmation route with a real seller session.
- Whether `RESEND_API_KEY` / `EMAIL_FROM` are set on Vercel (irrelevant for orders today, since no order email exists).
