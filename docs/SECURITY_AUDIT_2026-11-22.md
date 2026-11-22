# Security audit — 22 Nov 2026

Scope: storefront (Next.js), admin console, seller app's direct Supabase access, and the live Supabase project (RLS, functions, triggers, storage). Each hole below was **proven against the live database first**, inside a rolled-back transaction, then fixed and re-tested the same way. A final HTTP check with the public anon key confirmed the fixes.

DB fix: `supabase/migrations/20261124000000_security_hardening.sql` (**already applied to production**).
App fixes: in the working tree, **not committed or deployed yet**.

## Fixed

| # | Severity | Hole (proven) | Fix |
|---|---|---|---|
| 1 | Critical | `create_order_atomic` callable by **anon** with a client-chosen total: a ₦18,000 item ordered for 1 kobo. Any signed-in user could also create orders in **any** store and drain its stock. | Anon can no longer call it. The total is computed in the DB. Signed-in callers must be the owner or active staff (`NOT_AUTHORISED`). |
| 2 | Critical | `/api/mock-pay` was live. The buyer gets the pay token, so any buyer could mark their own order **paid** without paying. That gave free digital downloads, a "paid" order the seller would ship, and a "verified buyer" review. | Returns 404 unless `MOCK_PAY_ENABLED=true` and the deployment is not production. |
| 3 | Critical | Digital products were stored in the **public** `store-media` bucket, and `listings.digital_file_path` is publicly readable, so anyone could download a paid file for free. | Files now go to the new private `digital-goods` bucket, written by the service role after an ownership check. Downloads use 15-minute signed URLs behind the one-time token. |
| 4 | High | Pay-token HMAC key was derived from `ADMIN_EMAILS` (guessable). Anyone who knew the email could forge tokens for any order and see bank details, upload receipts or mark orders paid. | The key now comes from `PAY_TOKEN_SECRET`, or from the service-role key if that is not set. |
| 5 | High | Anyone could insert directly into `orders` (with `payment_status='paid'` and a spoofed `customer_id`), `order_items`, `bookings` and `store_ratings` (fake 5★ reviews to farm the blue tick). | Public insert policies dropped; all real writes already use server routes. |
| 6 | High | A seller could set `verification_status='verified'` (blue tick), `is_example` or `owner_id` on their own store. | `guard_store_plan` trigger now also guards these. The verification route writes with the service role after the 30-reviews check. |
| 7 | Medium | Anyone could read every reviewer's **phone number** (`store_ratings.customer_phone`). | Column hidden from anon/authenticated. Stars, comment and date stay public. |
| 8 | Medium | Anyone could **list** every file in `store-media` and `avatars`, including bank-transfer receipts. | Listing is limited to the user's own folder. Public URLs still work. |
| 9 | Medium | `onboarding_funnel_events` (user ids and steps) and `store_follows` (who follows which store) were publicly readable. | Public read policies removed. |
| 10 | Medium | POS cashiers could change any listing field (price, title…). | Trigger: staff may change stock only. |
| 11 | Medium | Checkout summary gave digital download links and the receipt URL to anyone who had the order id. | These now require the pay token or the signed-in buyer. |
| 12 | Low | Admin gate trusted unconfirmed emails. Admin console sign-in had no rate limit and a 7-day cookie. | Requires `email_confirmed_at`. 5 tries per 10 min. Cookie lasts 1 h. |
| 13 | Low | Staff temporary passwords came from `Math.random`. | `crypto.randomBytes`. |
| 14 | Low | `.freebuff/vercel-env-check.env` (a Vercel OIDC token, now expired) was committed. | Untracked and git-ignored. It is still in git history. |

Regression checks passed: owner edits store and listing, owner POS sale (DB total correct even when the client sent 1), server checkout with delivery fee (correct total), cashier stock change, public reviews readable, public store reads.

## Left for you (needs a decision or a dashboard toggle)

- **Turn on leaked-password protection**: Supabase → Auth → Password security.
- **Set `PAY_TOKEN_SECRET`** in Vercel (a random 32+ byte value). It works without it, but a separate secret can be rotated on its own.
- **Payment receipts are still in a public bucket**. They can no longer be listed, but anyone with the URL can open them. Moving them to a private bucket with signed URLs means changing the seller and admin views.
- **Rate limiting is in-memory per server instance.** On Vercel that is weak: AI and auth endpoints can be hammered across instances. Use Upstash/Redis or Vercel WAF rate rules.
- **Custom domains**: an admin activates a domain by hand. Check DNS ownership before activating.
- **Referrals**: anyone can claim any referrer. If referrals ever earn money, validate them on the server.
- `trending_products` is a security-definer view (advisor ERROR). It only exposes aggregate counts, so this is acceptable, but it is worth knowing.
- Add a `SECURITY.md` with a responsible-disclosure contact (per AI_STARTUP_GUARDRAILS §4).
