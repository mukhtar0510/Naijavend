# KWARAVEND_IMPROVEMENTS.md (v2)

Instructions for the AI coding agent working on this app (currently live as Naijavend at naijacart-roan.vercel.app, being renamed **Kwaravend**).
Read this whole file before changing anything.

This replaces `NAIJAVEND_IMPROVEMENTS.md`. Changes in v2:
- **Paystack and all online payment processing are DEFERRED.** Do not build them.
- The app is renamed to **Kwaravend**.
- New: **Cart**, **Map and logistics/tracking upgrade plan**, **Scale plan**.

---

## 0. Context

The app turns a Nigerian seller's WhatsApp catalogue into a real storefront: catalogue, orders, bookings, POS, staff, map, reviews and a blue tick. 0% commission, free to start.

A funder-style review found:
- The problem is real, but there is **no proof of traction** (no real stores, orders or revenue shown).
- The **business model is unclear**, because everything valuable is free.
- The product is **too broad**.
- The **marketplace has no supply** yet.
- The "live demo" store is **sample data presented as live**.
- Naming was inconsistent (URL says naijacart, brand says Naijavend).

**Goal for this phase: make the core loop reliable, honest and ready to monetise, then add cart, logistics tracking and a stronger map, then prepare to scale city by city.**

Core loop: seller creates store, shares one link, buyer adds items to cart and orders, seller confirms, delivery is tracked, buyer reviews.

---

## 1. Ground rules

1. **Inspect the repo first.** Identify the framework, routing, data layer, auth, map library and any existing payment code. Summarise what you found before editing. Do not assume a stack.
2. **Small, reviewable changes.** One task per branch or commit. No full rewrites.
3. **No destructive data or schema changes** without a migration and a note to the owner.
4. **No fake claims.** Never invent stats, testimonials, seller counts, reviews, logos or partnerships. If unknown, omit it or label it as sample data.
5. **Mobile-first and data-light.** Assume mid-range Android phones and slow or unstable connections. Watch bundle size, image weight and battery use.
6. **Prices in naira (₦)**, formatted consistently (₦8,500).
7. **Prices, stock, delivery fees and totals are computed server-side.** Never trust client values.
8. **Payments are deferred (see section 5).** Do not integrate Paystack, Flutterwave or any card or payment processor. Do not ask for or store API keys. Build the structure so a provider can be added later without rewriting checkout.
9. **Keep location private by default.** Buyer coordinates are computed in the browser for distance. They are only sent to the server when the buyer explicitly shares a delivery location for an order (see section 7).
10. Run lint, type-check and build before finishing each task. Report what you could not test.
11. Plain, practical copy written for a Nigerian seller, not for investors.

---

## 2. Rename to Kwaravend

The brand name is a single constant so it can change again cheaply.

- Create `BRAND` config (name, short name, tagline, support WhatsApp, domain, social handles) and use it everywhere. No hard-coded brand strings in components.
- Replace "Naijavend", "NaijaVend", "naijavend", "Naijacart", "naijacart" and "NV-" order prefix. Suggest order ID prefix **KV-** (config-driven).
- Update: page titles, meta description, OG and Twitter tags, manifest and PWA name, favicon and theme text, email and WhatsApp message templates, receipts and QR cards, legal pages (Privacy, Terms, Cookies), footer, FAQ, About, social links.
- Store URLs: keep `/s/<store-slug>` routes working. If domains change, add **redirects** from old paths. Do not break existing shared store links.
- Produce a **rename report**: every place the old name was found, what changed, and what the owner must do manually (new domain, Vercel project name, social handles, sender names, Google/Search Console).
- Do not change the deployed domain yourself. List it as an owner task.
- The brand is Kwara-flavoured, so the **launch region defaults to Kwara State (Ilorin)** in copy and the default city filter. Keep it config-driven (`LAUNCH_REGION`) and ask the owner to confirm (see section 15).
- Avoid copy that implies nationwide coverage. Say "Starting in Ilorin and Kwara State."

---

## 3. Priority 1: Honesty and trust (do first)

### 3.1 Label sample data
- The landing demo (example store, sample order, rating card) must be visibly labelled **"Example store" / "Sample data"**.
- Fix or remove the broken-looking counters ("0 Link…", "0 Layers…").
- Add `SHOW_DEMO_STORE` flag so the demo can be turned off once real stores exist.

### 3.2 Claims audit
Verify every claim on the site against the code (for example "every layer is already live", "server-verified prices", "reviews only from real orders", "location never leaves your browser", "POS and staff free").
Output a table: claim, verified yes/no, file, action. Change copy to match reality or open a TODO.

---

## 4. Priority 2: Narrow the focus

### 4.1 Landing page
- Hero around one outcome. Suggested copy (adapt to the brand):
  - Headline: "Your business deserves more than a WhatsApp catalogue."
  - Sub: "Create an online store, take orders and deliveries, and let customers near you find you. All in one link."
- CTAs: **Open your store, free** and **See an example store**.
- Section order: hero, 3-step how-it-works, short real product demo (screenshots or short video of the actual dashboard), outcomes (**Sell, Manage, Deliver**), real seller stories (hide when empty), simple pricing, FAQ and trust.
- Shorten the page. Collapse or remove the five-layer explainer, long journey timeline and long story blocks. Keep one short story on `/about`.

### 4.2 Launch segments
- Lead with **food and cakes, beauty and braids, fashion and accessories**. Others as secondary categories.
- City/area selector in onboarding and discovery, default **Ilorin**, with an "other city" option that joins a waitlist rather than showing an empty marketplace.

### 4.3 Feature flags (hide, don't delete), default **off** in production
- Dropshipper mode
- Advanced multi-branch tooling
- Rankings page and ranking algorithm
- Heavy storefront customisation (fonts and many colour options). Replace with 3 to 5 templates plus logo and accent colour.

---

## 5. Payments: DEFERRED (build the structure only)

The owner is not ready for online payments. **Do not implement Paystack or any gateway.**

### 5.1 Supported payment methods for now
1. **Pay on delivery / pay on pickup** (cash or POS at handover)
2. **Bank transfer, seller confirms** (seller sets account details; buyer pays outside the app and optionally uploads proof)
3. **Pay via WhatsApp** (current behaviour: order summary pre-filled)

### 5.2 Order and payment model
- Separate **order status** from **payment status**.
  - Order status: `pending`, `confirmed`, `preparing`, `ready`, `out_for_delivery`, `delivered`, `completed`, `cancelled`.
  - Payment status: `unpaid`, `awaiting_confirmation`, `paid`, `refunded`, `failed`.
- Payment method field: `cash_on_delivery`, `bank_transfer`, `pay_on_pickup`, `other`.
- For bank transfer: buyer can upload a **proof image** (size-limited, compressed). The seller marks it paid after checking their own bank. Log who confirmed and when.
- Show buyers a clear status timeline.
- Never claim an order is "paid" unless the seller confirmed it.

### 5.3 Future-proofing (do not implement the provider)
- Create a `PaymentProvider` interface (create session, verify, refund, webhook handler) with **no real implementation**, only the manual provider implemented.
- Keep a `payments` table or collection ready (order id, method, provider, reference, amount, status, timestamps).
- Add a feature flag `ONLINE_PAYMENTS_ENABLED=false` and a TODO comment where a provider would plug in.
- Copy must stay honest: do not say "pay securely online". Say "Pay on delivery or by transfer."

### 5.4 Plans (billing stays off)
Build the plan model and feature gating only. No billing code.

| Plan | Contents | Price to test |
|---|---|---|
| Starter | Storefront, catalogue, cart, orders, basic stock, WhatsApp handoff, status tracking | Free |
| Business Plus | Light CRM, sales reports, rider/dispatch tools, notifications, inventory alerts | ₦1,500 to ₦5,000/month (configurable) |
| Business Pro | Custom domain, staff permissions, multi-branch reporting, integrations | ₦8,000 to ₦15,000/month (configurable) |

- Prices live in config or the database, not hard-coded.
- Add `hasFeature(store, "feature_key")` helpers.
- Ask the owner before changing the "POS and staff are free" promise.

---

## 6. Cart feature

Build a proper cart so buyers can order several items in one go.

### 6.1 Buyer experience
- **Add to cart** on product cards and product pages (with variant, size, colour, quantity).
- **Cart drawer or page** per store: items, quantity steppers, remove, notes per item, subtotal, delivery fee (once address or zone is known), discount code, total.
- **Cart is per store.** If a buyer adds from a second store, keep a separate cart per store and show a clear "You have items from another store" prompt. Do not mix sellers in one order.
- **Persistence:** save to `localStorage` (try/catch, it can fail in private mode) and keep it across refreshes. Sync to the account if the buyer is signed in. Expire stale carts (for example 30 days).
- **Stock-aware:** show "Only 3 left", block over-ordering, and re-validate on checkout. If an item became unavailable or a price changed, show a clear message and let the buyer fix the cart.
- **Cart badge** in the header with item count. Works on mobile with a sticky bottom "View cart" bar.
- **Guest checkout:** name, phone, delivery or pickup choice, address and area, optional map pin (section 7), payment method (section 5), note to seller.
- **Order confirmation page** with order ID (KV-xxxx), summary, status timeline and a shareable tracking link.
- **WhatsApp handoff:** pre-filled message listing items, quantities, totals, delivery area and order ID.

### 6.2 Seller side
- New orders show all line items, delivery or pickup details, buyer contact and payment method.
- Accept, reject (with reason), edit availability, mark status changes.
- Bookings (services) can still be booked directly. Optionally allow service + products in one cart later (flag it).

### 6.3 Technical
- Server computes totals (items, discounts, delivery fee). The client total is display-only.
- Orders store a **snapshot** of item name, price and options at order time.
- Idempotent order creation (avoid duplicate orders on double-tap or retry).
- Rate limit order creation and guard against spam orders (phone-based throttle, honeypot).
- Analytics events: `cart_item_added`, `cart_viewed`, `checkout_started`, `order_created`, `cart_abandoned` (client-side, privacy-respecting).
- Optional later: abandoned-cart WhatsApp nudge link for the seller to send manually (no auto-messaging).

---

## 7. Map upgrade plan and logistics tracking

Inspiration: Nigerian logistics and delivery tools such as Fez Delivery, GIGL, Dellyman, Sendstack and Trackdeck. They offer live tracking links for customers, dispatch and rider assignment, delivery status with notes, proof of delivery and delivery analytics. The owner also named **Item7**; I could not verify its exact feature set. Confirm which Item7 features the owner liked before building anything beyond what is here.

**Principle: integrate, don't become a logistics company.** Sellers use their own riders or local dispatch partners. The app provides the **tracking layer**, not a fleet.

### 7.1 Phase A: Better map (no live GPS)  *(do first)*
- Use an open map stack (for example **MapLibre GL or Leaflet with OpenStreetMap tiles**). Check what exists in the repo and keep it if it is fine. Mind tile usage policy; plan for a hosted tile provider if traffic grows.
- **Store map:** pins for stores, **marker clustering**, category filter chips, "open now" filter, search by area, bottom-sheet store preview on mobile.
- **Near me:** distance and direction computed **in the browser**. Add a clear "Use my location" button and a manual area picker for people who decline GPS.
- **Store page map:** address, **Get directions** (deep link to Google Maps / Apple Maps), landmark and "how to find us" note, optional photo of the shop front. Landmarks matter more than formal addresses in many Nigerian areas, so add a **landmark/description field** to addresses.
- **Delivery zones:** seller defines zones by **area names** first (Phase A), with a per-zone fee, minimum order and estimated time. Polygon zones drawn on the map come later (Phase B).
- Lazy-load the map (not on first paint). Provide a low-data fallback (static list view) when the map fails or the connection is slow.
- Cache tiles and store data sensibly. Test on slow 3G.

### 7.2 Phase B: Delivery tracking (status-based)  *(core logistics value)*
- Delivery record per order: type (`own_rider`, `partner`, `pickup`), assigned rider (name, phone), status, notes, timestamps.
- Statuses: `awaiting_dispatch`, `assigned`, `picked_up`, `in_transit`, `arrived`, `delivered`, `failed_attempt`, `returned`.
- **Public tracking page** `/track/<token>` (unguessable token, no login):
  - Order summary (no sensitive data), timeline with timestamps, rider first name and tap-to-call or WhatsApp, estimated time window, store contact.
  - Shows a **map with store pin and delivery pin** (static route line, no live position yet).
- **Seller dispatch board:** list of active deliveries by status, assign rider, one-tap status updates, filters by branch and date. Works well on a phone.
- **Riders directory:** seller adds their riders (name, phone, vehicle). Rider can be marked active or inactive.
- **Notifications:** WhatsApp click-to-chat links and in-app messages at key status changes (assigned, picked up, arrived, delivered). Do not auto-send WhatsApp messages without the official API. Provide pre-filled links.
- **Proof of delivery:** delivery confirmation by **OTP/PIN shown to the buyer** that the rider enters, or a **photo upload**. Store the result with timestamp.
- **Failed delivery handling:** reasons (unreachable, wrong address, refused), reschedule, return to seller.
- **Delivery fee calculator:** by zone, flat fee, or distance bands (computed server-side from seller-defined rules).
- **Polygon delivery zones** drawn on the map by the seller, with a point-in-polygon check at checkout.

### 7.3 Phase C: Live rider tracking  *(only after Phase B is used by real sellers)*
- **Rider PWA page** (`/rider/<token>`) that works on a basic Android phone: shows assigned deliveries, one-tap status buttons, and an optional "Share live location" toggle.
- Rider location is **opt-in, per delivery, and stops automatically** when the delivery completes or after a timeout.
- Throttle location updates (for example every 10 to 20 seconds while moving, slower when still) to save battery and data. Use polling or server-sent events before considering anything heavier.
- Buyer tracking page shows the **moving rider marker** and ETA. Degrade gracefully to the status timeline if the live feed is stale.
- Privacy: location data is deleted or aggregated after a retention window (for example 7 to 30 days). Never expose rider location to anyone except the buyer of that order and the seller. Disclose in Privacy policy.
- Handle poor connectivity: queue updates offline and send when back online.

### 7.4 Phase D: Partner and provider integrations  *(optional, later)*
- Let sellers choose a **delivery partner** per order (manual entry of a partner's tracking number and a link) as the first step.
- Only then explore API integrations with local providers (for example Fez, GIGL, Dellyman, Sendstack). **Verify each provider's current API, pricing and terms before building.** Put each behind a feature flag and an adapter interface (`DeliveryProvider`) so any one can be swapped.
- Aggregate multiple providers' quotes later only if sellers ask for it.

### 7.5 Data model sketch (adapt to the repo's stack)
- `delivery_zones` (store/branch id, name, type area|polygon, geometry or area list, fee, min order, eta)
- `riders` (store id, name, phone, vehicle, active)
- `deliveries` (order id, type, rider id, status, tracking token, pickup address, drop address, drop lat/lng optional, otp hash, pod photo, notes, timestamps)
- `delivery_events` (delivery id, status, note, actor, created at)
- `rider_locations` (delivery id, lat, lng, accuracy, ts) with a short retention policy
- Add indexes on tracking token, store id and status. Add row-level access rules so each seller sees only their own records.

### 7.6 Logistics metrics
- On-time rate, average delivery time, failed-delivery rate and reasons, deliveries per rider, cost per delivery, orders by zone.

---

## 8. Core product improvements

### 8.1 Seller onboarding
- Target: **store with 3 products live in under 5 minutes on a phone.**
- Dashboard checklist: logo, first 3 products, hours, WhatsApp number, bank details (for transfer), delivery zones, share link.
- Fast bulk add: photo, name and price with minimal fields.
- Track setup completion.

### 8.2 Orders and stock
- Order list with status and date filters; one-tap status changes.
- Stock decrements when the seller confirms. Low-stock warnings.
- New-order alerts (in-app, plus WhatsApp link to the seller's own number).

### 8.3 Light CRM
- Customers built from orders: name, phone, order count, total spent, last order, notes, repeat-customer badge, one-tap WhatsApp.

### 8.4 Bookings (beauty and services)
- Keep slot booking and double-booking prevention. Add an optional deposit field (record only, since payments are deferred).

### 8.5 Analytics
- Sales this week, top products, low stock, returning customers, orders by source (link, QR, map), cart-to-order conversion, delivery performance.

---

## 9. Trust and marketplace (limited)

- Reviews only from real orders or bookings, verified server-side.
- Public blue-tick rule must match the code. Add an admin revoke tool.
- Report store and report review flows plus a simple moderation queue.
- Clear cancellation, refund and dispute text at checkout and in Terms.
- Keep Rankings and "marketplace" hidden until there is enough real supply in a city (suggested trigger: **50+ active stores in a city**). Before that, show a city-filtered Discover list.

---

## 10. Measure what matters

Privacy-respecting event tracking. Events: `store_created`, `store_published` (3+ products and hours), `product_added`, `stock_updated`, `cart_item_added`, `checkout_started`, `order_created`, `order_confirmed`, `delivery_assigned`, `delivery_completed`, `booking_created`, `store_link_shared`, `qr_downloaded`, `buyer_enquiry`.

Owner-only admin dashboard:
- Stores created, published, and **weekly active** (did at least one of: add/update product, update stock, process an order, update a delivery, in the week).
- Setup completion (target 70%), stores with at least one order or enquiry, 30-day retention (target 50%).
- Order volume and ₦ value (recorded GMV, even though payments are off-platform), delivery on-time rate.
- Per-city breakdown.

---

## 11. Scale plan (after the rename)

Scale **city by city, only after the previous stage hits its trigger.** Do not market nationally yet.

### Stage 1: Prove it in one place (Ilorin / Kwara)
- Goal: **30 to 50 real, active stores**, mostly in 2 or 3 categories.
- Trigger to move on: 60% weekly active, 50% 30-day retention, at least 500 completed orders, at least some sellers willing to pay or clearly using delivery tracking.
- How to get stores:
  - Walk markets and shopping areas with QR stickers and onboard sellers in person.
  - Partner with trader and market associations, campus communities (including tech and student groups), WhatsApp business groups and local influencers.
  - Appoint a few **seller ambassadors** who onboard others for a small reward (track referrals with a code).
  - Offer to set up the first 3 products for each seller free of charge.
- Get 5 to 10 **case studies with numbers** (orders gained, time saved) for the landing page.

### Stage 2: Deepen in the home city
- Add delivery zones, riders and tracking (section 7 Phase B) as the main reason to stay.
- Launch paid plans (Business Plus) with a pilot discount, then consider enabling online payments **once the owner is ready**.
- Start buyer-side discovery: city map, "open now", category pages, repeat-buyer reminders for sellers.

### Stage 3: Nearby cities
- Expand to nearby cities in the region and then other states where the owner has a contact or community (suggest ordering by existing relationships, not by size).
- Per-city launch playbook: 1 local ambassador, 20 seeded stores before public launch, city page live only when it has supply, waitlist before that.
- Make the product city-aware: `cities` table, per-city default map centre and zoom, per-city landmarks, per-city delivery partners list.

### Stage 4: Multi-city platform
- Rankings and marketplace discovery switch on per city once the supply threshold is met.
- Language support (English first, then Pidgin, Yoruba and Hausa where useful) through an i18n layer.
- Partner integrations with logistics providers and (later) payment providers.
- Seller support: help centre, in-app chat to the team, onboarding video.

### Technical scaling checklist
- Database: indexes on store, city, status, created date; pagination on all lists; avoid N+1 queries.
- Images: compression on upload, responsive sizes, CDN caching, lazy loading.
- Caching: cache public store pages and discover lists with sensible revalidation; invalidate on seller edits.
- Background jobs for notifications, report generation and cleanup (location retention, expired carts).
- Rate limiting and abuse protection on signup, orders, reviews, reports and tracking endpoints.
- Observability: error tracking, uptime checks, basic logs, a status page, backups with a tested restore.
- Security: role-based access (owner, manager, cashier, rider), audit log for staff actions, secure tracking tokens, input validation everywhere.
- Cost: track hosting, storage, map tile and support cost **per active store** and keep it below what a paid store would bring in.

### Business scaling levers
- Paid plans (CRM, dispatch tools, reports), custom domains, and later payment processing margin.
- Optional delivery marketplace fee or partner referral fees (only if sellers and riders find value).
- Sponsored placement is **not** a launch idea. It damages trust while supply is small.

---

## 12. Performance, quality and legal hygiene

- Lighthouse mobile 90+ on landing and storefront pages. Map pages lazy-loaded.
- Accessibility: contrast, 44px tap targets, labelled forms, keyboard focus.
- Empty and error states for every list (no products, no orders, no stores in your area, map failed to load).
- Privacy, Terms and Cookies pages must match real data practices (including delivery tracking and location handling, Nigeria Data Protection Act awareness). Flag gaps for the owner rather than writing legal text yourself.
- Add terms for sellers who use riders (they are responsible for their riders) and a clear dispute and refund process.

---

## 13. Out of scope for now (do NOT build)

- Paystack, Flutterwave or any online payment processor, wallets, escrow
- Owning a rider fleet or a logistics company
- Dropshipper workflows
- Nationwide marketplace launch or rankings algorithm
- Auto-sending WhatsApp messages through unofficial methods
- New categories or extra storefront customisation

---

## 14. Order of work

1. Repo audit and summary (stack, data model, map library, existing payment code)
2. Rename to Kwaravend with `BRAND` config, redirects and rename report (section 2)
3. Sample-data labelling and claims audit (section 3)
4. Landing page rewrite and feature flags (section 4)
5. Order and payment status model, manual payment methods, `PaymentProvider` interface with no provider (section 5)
6. Cart feature (section 6)
7. Seller onboarding checklist and fast product add (8.1)
8. Map upgrade Phase A and delivery zones by area (7.1)
9. Delivery tracking Phase B: dispatch board, riders, public tracking page, proof of delivery (7.2)
10. Event tracking and admin dashboard (section 10)
11. Plan model and feature gating, billing off (5.4)
12. Light CRM and analytics (8.3, 8.5)
13. Trust, reporting and moderation basics (section 9)
14. Performance, accessibility and scaling checklist (sections 11 and 12)
15. Only after real usage: Phase C live rider tracking, then Phase D provider integrations

After each step: lint, type-check, build, then give the owner a short summary of what changed, what to test and what was not done.

---

## 15. Definition of done (this phase)

- One consistent brand name (Kwaravend), config-driven, old links still work.
- No fake "live" claims; demo is clearly labelled.
- Buyer can add items to a cart, check out as a guest and see an order status timeline.
- Orders support pay on delivery, bank transfer with proof and WhatsApp handoff. No payment gateway code exists.
- Seller can set delivery zones, assign a rider, update delivery status and the buyer sees a tracking page.
- Map has clustering, filters, near-me (in-browser) and directions.
- Owner can see weekly active stores, orders, ₦ order value and delivery performance in an admin view.
- Deferred features are flagged off, not deleted. Plans exist with gating, billing off.

## 16. Questions to ask the owner before proceeding

- Confirm the direction of the rename: **Naijavend to Kwaravend**? And is **Kwara / Ilorin** the launch region?
- What exactly did you like about **Item7** (public tracking link, dispatch, rider app, pricing calculator, something else)?
- Do sellers mostly use their own riders, or local dispatch companies? Which ones in Ilorin?
- Is "POS and staff are free" a permanent promise, or can limits apply?
- Which real stores can replace the demo store?
- New domain for Kwaravend, and who handles the Vercel and DNS change?
- When you are ready for payments later, which provider do you want to start with?
