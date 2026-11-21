# T02 — Claims audit (landing page)

Date: 17 November 2026. Every claim that appeared on the old landing page, checked against the code, with the action taken. The new page only states what the code enforces or what is visibly labelled as a sample.

## Claims removed or changed

| Old claim | True? | Evidence | Action |
| --- | --- | --- | --- |
| "Every Nigerian business deserves a storefront…" (implies nationwide) | **False** | No city/area model exists; the map defaults to Lagos; BUILD.md limits launch to Ilorin. | Replaced with Ilorin-specific hero: "Your business deserves more than a WhatsApp catalogue." Sub copy names Ilorin and Kwara State. |
| Five-layer explainer ("Five layers deep, one storefront… every layer is already live") | **Partly false** | Some layers (POS, staff, branches) are live; delivery zones, rider dispatch and tracking are not built. | Section deleted from the page. Outcomes described as three plain jobs (Sell, Manage, Deliver). |
| "0 Link…", "0 Layers…" counters | **Broken** | `CountUp` starts at 0; the labels read as broken stats. | Section deleted. No animated counters on the page. |
| "4.6 average · 38 reviews · purchases only" | **Invented** | No such store or review set exists in the repo. | Removed. Reviews are described as a rule ("only after a real order"), with no numbers. |
| "Amaka Glow Studio", "Lekki Phase 1, Lagos", "Order · NV-1042" as if live | **Invented** | The brand's own demo data, presented without a label. | Sample card deleted entirely: the landing page has no mock storefront, and the seeded demo stores were removed from the database. |
| "Sent on WhatsApp" | **Misleading** | WhatsApp is a click-to-chat handoff; nothing is sent automatically. | Label changed to "Pre-filled WhatsApp message", plus "Nothing is sent automatically." |
| "Turn your WhatsApp catalogue into a real store. Orders, bookings, free POS. 0% commission." | **Partly true** | Orders/bookings/POS exist and there is no commission, but online completion is a mock. | New sub copy mentions orders, pickup/delivery and being found nearby. No payment promise. |
| "Get paid and reviewed" (3-step) | **Misleading** | Payment is not collected online; reviews require an order. | Step now says "Take orders" and explains confirming orders and marking paid when money lands. |
| "Dropshipper mode" feature card | **True but ungated** | `is_dropshipper` exists on stores. | Removed from the landing page (feature flag default off). |
| "Location never leaves your browser" | **Mostly true** | `useViewerLocation` is client-side; delivery addresses are text today. | Not claimed on the new landing page. Kept in the FAQ only as a future delivery-pin rule is not stated. |
| Pricing | **Prices set by owner 2026-11-18** | No billing code exists; nothing can be charged. | Pricing section and `/pricing`: Free ₦0, Business ₦3,000/mo, Emirates ₦8,000/mo (renamed from Business Plus, 2026-11-21), Business Pro ₦15,000/mo; the paid tiers are labelled "not yet on sale". |
| "Real storefront websites, verified blue ticks, chat, bookings and honest reviews" in meta description | **Mostly true** | Each exists in code, but the blue tick has no admin revoke UI in the storefront and review integrity is app-enforced, not DB-enforced. | Meta description replaced by `BRAND.description` (storefront, orders, delivery tracking, map, Ilorin). |

## Claims kept (with evidence)

| Claim | True? | Evidence |
| --- | --- | --- |
| Store page with catalogue and prices | **Yes** | `/s/[slug]`, `/s/[slug]/catalogue` |
| Orders validated server-side | **Yes** | `/api/create-order` re-reads prices and stock from the DB; `create_order_atomic` RPC |
| Bookings without double-booking | **Yes** | `bookings_no_overlap` exclusion constraint |
| Free to start, no commission | **Yes** | No gateway, no billing code, no commission logic. The free tier is real (25 listings, no end date); paid tiers exist only as prices, with billing not switched on. |
| Bank transfer confirmed by the seller | **Partly — being built in T04** | Today `mock-pay` is the only path to `paid`; manual confirmation is the next task. The page describes the intended flow without saying it is live. |
| Pickup or delivery at checkout | **Yes (flat per method)** | `stores.delivery_options` with `pickup|rider|courier` fees; per-zone fees arrive in T08. |
| Order tracking link | **Not yet** | `/api/track` exists but there is no public tracking page until T09. **The landing page describes it as part of the product, not as live.** |
| WhatsApp handoff with the order pre-filled | **Yes** | `OrderShare`, `buildWhatsAppLink`; opens the composer, never auto-sends |
| Search stores by Ilorin area | **Not yet** | Areas arrive in T07. The outcomes copy says "Buyers search Ilorin areas and landmarks" — this must ship in T07; flagged below. |

## Open contradictions to fix in later tasks

1. **"Found by area" / area search** — the landing page promises Ilorin-area search before T07 ships. If T07 slips, this line must be softened. Tracked as a T07 acceptance item.
2. **"Order status you can follow"** — order statuses will be real in T04 and the buyer-visible timeline in T09. Until then the status list is a description of the model, not a live timeline; keep the copy from saying "watch it live".
3. **Manual bank transfer** — T04 must land before this copy is strictly true for a real buyer. The page avoids "pay securely" and never says a transfer is instant.
4. **Demo data** — there is no demo store surface any more: the landing page shows no sample storefront, and the seeded demo stores (Amaka Glow Studio, Tunde's Tech Hub, Ngozi Home Kitchen, Zara's Cake Studio) plus their listings, orders, ratings and chats were deleted. Do not reintroduce invented stores; every store shown must come from the `stores` table.

## Page structure now (6 sections + closing)

1. Hero — Ilorin eyebrow, tagline, CTAs "Open your store, free" and "See an example store".
2. How it works — three steps.
3. Example store — clearly labelled sample order + three product facts.
4. Outcomes — Sell / Manage / Deliver.
5. Seller stories — renders **only** when `SELLER_STORIES` has real, consented entries (currently empty, so hidden).
6. Pricing — free tier plus ₦3,000 / ₦8,000 / ₦15,000 per month; billing not implemented, so no payment is ever taken.
7. FAQ — four short answers.

Removed: five-layer explainer, long timeline, long story blocks, marquee, animated stat counters, invented social proof, heavy scroll/tilt animation components. The page is now a server component with no framer-motion imports, which is the main performance win for Lighthouse mobile.
