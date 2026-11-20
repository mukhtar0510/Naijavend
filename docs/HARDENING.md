# Hardening — T14

What is enforced today, what T14 changed, and what still needs an owner decision.
Everything below describes the code in this repository; nothing here is a claim
about the live Vercel project's settings.

## T11 / T12 disclosure

| Surface | Real | Still mock |
| --- | --- | --- |
| `dashboard/plan` | Plan name, listing/staff/location counts, limit bars | Pricing, upgrade flow, requests (`RequestAccess` writes nothing) |
| `dashboard/customers` | Customer list from orders; notes persisted in `store_customer_notes` | Nothing — notes fall back to this browser if the migration is absent |

Plan **prices** were set by the owner on 2026-11-18: a free tier, then ₦3,000 /
₦8,000 / ₦15,000 per month. The **limits** in `src/lib/plans.ts` are still
placeholders for gating tests, and there is no billing code, so nothing is ever
charged. The public list lives at `/pricing`, rendered from that one module.

## Migrations — applied and history repaired 2026-11-18

`supabase db push` reported *"Remote database is up to date"* at the end of this
work, so the migration history now matches the repo.

### What was actually wrong

Production's history contained 24 versions applied outside the CLI (timestamped
`20260912…`–`20261017…`), while 25 local migrations were missing from it. The
CLI therefore refused to push at all.

Digging into the 7 local migrations marked pending turned up **three real
production bugs**, not just bookkeeping:

1. **`create_order_atomic` never existed in any environment.** The original
   `20261003000001` file used `foreach p_listing_ids as idx loop` (not Postgres
   syntax) and declared variables mid-block, so Postgres rejected the function
   at creation time. Both `/api/create-order` and `/api/pos/charge` call it and
   `throw` on error — so online checkout and POS charge both failed with a 500.
2. **The store theme columns never existed** (`20261005`, `20261006`):
   background image, page width and section colours were missing.
3. **The analytics views never existed** (`20261114000000`), so the seller
   analytics page was falling back to pulling raw rows.

### What was done

- `20261118100000_create_order_atomic_fix.sql` — new migration with a working
  function. It also takes `p_customer_id`, `p_delivery_fee_kobo` and
  `p_discount_kobo`, and accepts the JSON payload as either an array or a
  string (the callers `JSON.stringify` it, which PostgREST delivers as a
  scalar). `/api/create-order` no longer pre-inserts the order — doing so had
  produced a second, empty order on every successful checkout.
- `20261003000001` is now an intentional no-op pointing at the fix; its body
  could never run.
- `20261011` got a `drop policy if exists` guard (the policy already existed,
  which aborted the file mid-way). `20261004` widened its feature list to a
  superset of the rows already stored, so the constraint can be added.
- 34 local migrations were marked **applied** (`migration repair`) after
  checking their objects exist, and the 24 out-of-band versions were marked
  **reverted** so they stop blocking pushes.

### Verified

- `orders` has all five payment columns; `store_customer_notes` exists.
- `create_order_atomic` exists with the 11-argument signature.
- A real test order was created through `/api/create-order`: 201, one order
  row, one order item, `payment_method` stored, stock decremented — then the
  order was deleted and the stock restored.

### Caveat

The SQL for those 24 out-of-band versions is **not in this repo** — only their
objects are in the database. A `supabase db reset` on an empty database would
not reproduce production. A `supabase db pull` baseline is the way to fix that
properly, and was deliberately not done here because it rewrites local history.

Now that the columns exist, the graceful-degradation paths (503 on confirm,
browser-only CRM notes, WhatsApp receipt fallback) are no longer exercised in
production.

## Payment proof upload

`/api/orders/proof` accepts a JPG/PNG/WebP/PDF up to 5 MB, authorises the caller
by signed-in customer **or** the order's HMAC payment token, stores the file in
`store-media/payment-proofs/<orderId>/`, and sets `payment_status =
'awaiting_confirmation'`. Rate limited to 6 uploads a minute per IP. The seller
sees the status in Orders and confirms with a button.

No destructive change is included, and no existing column is removed.

## What the app enforces

- **Sessions**: seller and customer sessions are httpOnly cookies. Server pages
  re-check auth (`getSellerClient`, `getCustomerUser`) instead of trusting a
  client redirect.
- **Row-level security**: every seller query runs through the user's own JWT, so
  Supabase RLS is the authorisation boundary. The admin app uses a separate
  client.
- **Staff scoping**: `StaffGuard` + `redirectStaffToPos` keep staff inside
  `/dashboard/pos` and `/dashboard/orders`; `/dashboard/plan` refuses staff even
  on a typed URL.
- **No online payments**: `ONLINE_PAYMENTS_ENABLED = false` in
  `src/lib/flags.ts`, and no gateway SDK is installed. Checkout is a WhatsApp
  hand-off.
- **Security headers**: CSP, `nosniff`, `frame-ancestors 'none'`,
  `object-src 'none'` and no `X-Powered-By`, set in `next.config.mjs`.
- **Feature flags**: `src/lib/flags.ts` is the only switchboard. Flagged routes
  redirect at config level so a disabled surface cannot be served as an empty
  200 page.

## Changed in T14

1. `src/app/error.tsx` — branded route error boundary that logs the Next error
   digest and offers retry/home instead of a blank page.
2. Ranked navigation is state-scoped: the rankings board filters stores to Kwara
   by coordinates (address text as fallback), so a small board is still an
   honest one.
3. The store map is bounded to Kwara and centred on Ilorin
   (`maxBounds`, `minZoom: 7`); quick-pick locations are Ilorin districts.
4. Removed async components used as JSX children (`Promise<Element>` is not a
   JSX element type under the React 18 typings the deploy build uses). This was
   crashing production builds while passing a warm local typecheck.

## Verification run for this task

```
cd apps/storefront
rm -rf .next && pnpm build      # cache-free: forces the same type-check Vercel runs
npx next start -p 3100          # then curl the changed routes
```

Recorded results are in the task report. A cache-free build is the only build
result that counts for deploys — an incremental local build can skip files.

## Open items needing the owner

- **Apply the `customers` table migration** before the CRM notes move
  server-side; the mock stores notes per browser until then.
- **Rate limiting**: no limiter exists. Public POST routes (`/api/contact`,
  chat, AI) rely on Vercel's platform limits. Add an edge limiter or a
  per-IP counter before promoting the site.
- **RLS review**: confirm policies exist on `store_staff`, `store_events`,
  `referral_codes` and `podcast_*` — the audit could not run SQL against the
  live project.
- **Backups**: confirm the Supabase project has point-in-time recovery or a
  daily dump; nothing in the repo configures it.
- **Email verification / 2FA** for seller accounts is not implemented.
- **CSP nonce**: the policy still allows `'unsafe-inline'` for the inline theme
  bootstrap script. A nonce-based policy needs that script moved server-side.
- **Monitoring**: no uptime or error tracking service is wired in; the error
  boundary only logs to the server console.
