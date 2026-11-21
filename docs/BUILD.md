# BUILD.md: What to build, in order

App: **Kwaravend** (rename from Naijavend / naijacart). Storefronts, orders, delivery tracking and a map for Nigerian sellers, launching in **Ilorin, Kwara State**.

Companion file: `KWARAVEND_IMPROVEMENTS.md` has the reasoning and rules. **This file is the work order.** If they conflict, this file wins.

---

## How to work

1. **Step 0 first:** inspect the repo and report the stack, folders, data layer, auth, map library and existing payment code. Wait for no one; just write the summary and continue.
2. Build **one task at a time, in order**. Do not start a task before the previous one passes its checks.
3. After each task: run lint, type-check and build. Fix errors. Then output:
   - What changed (files)
   - How to test it (3 to 5 steps)
   - What is not done or uncertain
4. Small commits, one per task, message format: `T05: add cart drawer`.
5. Do not delete existing features. Hide with feature flags.
6. Mobile-first, low data, naira (₦) formatting, prices and totals computed on the server.
7. **Do not build online payments** (no Paystack, Flutterwave, wallets). Do not ask for API keys.
8. No invented stats, testimonials, stores or reviews anywhere.

---

## Task list

### T00: Repo audit
Output a short report: stack, routes, data model, auth, map library, hosting, existing payment code, feature list actually implemented vs. claimed on the landing page.
**Done when:** report written to `docs/AUDIT.md`.

### T01: Rename to Kwaravend
- Create a `BRAND` config (name, tagline, support WhatsApp, domain, socials, order prefix `KV-`, `LAUNCH_REGION = Kwara/Ilorin`).
- Replace all hard-coded "Naijavend / naijacart" strings: titles, meta, OG tags, manifest, favicon text, receipts, QR cards, WhatsApp templates, emails, legal pages, footer, FAQ, About.
- Keep `/s/<slug>` store URLs working. Add redirects for any changed paths.
- Write `docs/RENAME_REPORT.md`: every occurrence changed, plus owner tasks (domain, Vercel project name, socials).
**Done when:** searching the codebase for the old names returns nothing except the report and redirects.

### T02: Honest landing page
- Label the demo store and sample order **"Example store / Sample data"**. Add `SHOW_DEMO_STORE` flag.
- Fix or remove the broken counters ("0 Link…", "0 Layers…").
- Rewrite the hero: "Your storefront deserves more than a WhatsApp catalogue." with sub copy about orders, delivery and being found nearby in Ilorin. CTAs: **Open your store, free** and **See an example store**.
- New section order: hero, 3-step how-it-works, product demo, outcomes (Sell, Manage, Deliver), seller stories (hidden when empty), pricing, FAQ.
- Cut the five-layer explainer, long timeline and long story blocks. Keep a short story on `/about`.
- Audit every claim against the code; fix copy to match reality. Write `docs/CLAIMS_AUDIT.md` (claim, true/false, action).
**Done when:** the page is under about 6 short sections, makes no claim the code can't back up, and Lighthouse mobile performance is 85+.

### T03: Feature flags
Add flags, default **off** in production: dropshipper mode, rankings page and algorithm, advanced multi-branch tools, heavy storefront customisation. Hide nav links and routes behind them. Replace customisation with 3 to 5 templates plus logo and accent colour.
**Done when:** the flags work and nothing is deleted.

### T04: Order and payment model (no gateway)
- Order status: `pending, confirmed, preparing, ready, out_for_delivery, delivered, completed, cancelled`.
- Payment status: `unpaid, awaiting_confirmation, paid, refunded, failed`.
- Payment methods: `cash_on_delivery`, `bank_transfer`, `pay_on_pickup`, `other`.
- Bank transfer: seller stores account details; buyer may upload a proof image (size-limited, compressed); seller marks paid; log who confirmed and when.
- Add a `PaymentProvider` interface with only a **manual** implementation, plus `ONLINE_PAYMENTS_ENABLED=false`.
- Never show "paid" unless the seller confirmed it. Never say "pay securely online".
**Done when:** orders move through both status tracks and the seller can confirm a transfer.

### T05: Cart
- Add to cart on product cards and pages (variant, quantity, note).
- Cart drawer/page **per store**, with a prompt if the buyer adds from another store.
- Persist in `localStorage` (wrapped in try/catch), sync to account when signed in, expire after 30 days.
- Stock-aware: "Only 3 left", block over-ordering, revalidate at checkout and show clear messages if prices or stock changed.
- Sticky "View cart" bar on mobile and a cart badge in the header.
- Guest checkout: name, phone, pickup or delivery, area and landmark, payment method, note.
- Server computes totals; the order stores a snapshot of name, price and options.
- Idempotent order creation, rate limiting, spam guard.
- Confirmation page with order ID (`KV-xxxx`), summary, status timeline, tracking link, and pre-filled WhatsApp handoff message.
**Done when:** a buyer can order 3 items in one go as a guest and the seller sees all line items.

### T06: Seller onboarding
- Dashboard checklist: logo, first 3 products, hours, WhatsApp number, bank details, delivery zones, share link.
- Fast bulk add (photo, name, price only).
- Target: store with 3 products live in under 5 minutes on a phone.
**Done when:** checklist progress is saved and visible.

### T07: Map upgrade, Phase A (Ilorin only)
**The map covers Ilorin, Kwara State and nothing else.** No country-wide or multi-city map for now.

- **Map stack (decided):** **MapLibre GL JS** with a **self-hosted Protomaps (PMTiles) extract of Ilorin and its outskirts**, built from OpenStreetMap data and served as one static file from cheap static storage (for example Cloudflare R2). No per-map-load billing, no usage caps, no vendor lock-in.
  - Cut the extract with the same bounding box as `MAP_CONFIG`. Host the map fonts and icons (glyphs and sprites) yourself too.
  - Make the **tile source a config value** (`MAP_CONFIG.tileSource`) so it can be swapped to a hosted provider (for example MapTiler Flex, about $30/month) without code changes.
  - Do **not** use OpenStreetMap's public tile server in production, and do not use MapTiler's free plan (it is for non-commercial use). Do not use Google Maps.
  - Replace the existing map library only if it is not MapLibre. Keep what works elsewhere in the app.
  - Search is not included in the tile file. Use the seeded Ilorin `areas` list and the landmark field for search; do not add a paid search API without asking the owner.
  - Before building, **check OpenStreetMap coverage of the Ilorin areas below** (main roads and area names) and report any gaps in `docs/AUDIT.md` so the owner knows where landmarks matter most.
- **Lock the map to Ilorin:**
  - Put the map config in one place (`MAP_CONFIG`): centre, default zoom, min zoom, max zoom, and a **bounding box** around Ilorin and its immediate outskirts.
  - Starting point (approximate, verify and tune on the real map): centre about 8.4966° N, 4.5421° E, default zoom 13, min zoom 11, max zoom 18.
  - Set `maxBounds` so users can't pan away from Ilorin. Keep `MAP_CONFIG` easy to change so another city can be added later without a rewrite.
  - Always open the map centred on Ilorin, even if the buyer's device is somewhere else.
- **Ilorin area list:** create a seeded `areas` list used for store addresses, delivery zones, search and filters. Suggested starting set (the owner must check names and spelling): Tanke, Gaa-Akanbi, Fate, Taiwo Road, Ipata, Oja-Oba, Sango, Unity, Ganmo, Adewole, Offa Garage, Oke-Odo, Ajikobi, Basin, Challenge, Mandate, Surulere, Pipeline, Kulende, Olunlade. Make it editable by the admin so areas can be added without code.
- **Only Ilorin stores appear on the map:**
  - On store setup, the seller picks an Ilorin area from the list and drops a pin. Reject pins outside the bounding box with a clear message ("Kwaravend is currently only in Ilorin").
  - Sellers outside Ilorin can join a **waitlist** (name, phone, city, category). They do not get a public map listing.
- Store map: pins, clustering, category chips, "open now" filter, **area filter** (the Ilorin areas above), search by area or landmark, mobile bottom-sheet preview.
- **Snap Map-style look and feel (owner request).** The owner wants the map to feel like Snapchat's Snap Map: playful, alive and visual. Build it as a **store-based** map, not a people-based one:
  - **Logo pins:** each store appears as a round pin with its logo or first product photo, a category-coloured ring, and a small name label that appears at higher zoom. Cluster into a count bubble when zoomed out.
  - **"Open now" glow:** open stores get a soft pulsing ring; closed stores are dimmed. Computed from the store's hours.
  - **Activity heat layer:** a soft heat overlay showing where orders and enquiries are happening in Ilorin. Use **aggregated, anonymised counts per area** (for example last 24 hours, minimum 5 events before an area shows), never individual buyer locations or exact order points. Toggle on and off.
  - **Store status / story badge:** stores can post one short daily status (photo plus text, expires after 24 hours). A badge on the pin opens it in a full-screen viewer. Moderate and report-enabled (see T13). Flag it off by default if it slows the first release.
  - **How Snap Map is actually built (for reference):** its base map is OpenStreetMap data delivered through Mapbox, with a custom visual style and its own layers on top. So the "Snap look" comes from the **style**, not from a special map. Recreate that look the same way: OpenStreetMap-based tiles (our Protomaps file) plus a custom MapLibre style. Do not switch to Mapbox for this.
  - **Custom soft map style:** build a custom MapLibre style (pastel land and water, rounded labels, bold area names) instead of default OSM colours. Optional **3D buildings** layer, **off by default** and enabled only on capable devices; it must not break slow 3G or low-end Android.
  - **Tap and swipe:** tap a pin for the bottom-sheet card (photo, rating, open status, distance, Order / WhatsApp / Directions); swipe up to a list of nearby stores. Smooth fly-to animation when picking an area.
  - **"Trending in Ilorin" strip** above the map: stores with the most orders or new reviews this week (only once there are enough real stores; hide it otherwise).
  - **Privacy rules (non-negotiable):** do **not** show buyers' or other people's live locations, friend maps or "who is nearby". Buyer location stays in the browser. Rider live location is **not** on the public map; it appears only on the order's own tracking page and only in Phase C. No "ghost mode" is needed because nobody's position is shared.
  - **Performance budget:** map code and style lazy-loaded; keep first load under about 250 KB of map JavaScript where possible; fall back to the plain list view if the device is slow or the map fails. Test on a mid-range Android phone on mobile data.
- **"Near me":** distance and direction computed **in the browser**. If the buyer is outside Ilorin or declines location, skip distance and fall back to the area picker. Never move the map outside Ilorin to follow the buyer.
- Store page: area, address, landmark and "how to find us" field (landmarks matter more than formal addresses), shop-front photo, **Get directions** deep link.
- Lazy-load the map and the tile file (range requests only, never download the whole file); fall back to a list view grouped by area on slow connections or failure.
- Remove or hide any "other city" or nationwide selector, and any copy that implies coverage outside Ilorin.
**Done when:** the map opens on Ilorin, can't be panned outside the bounding box, stores outside Ilorin are rejected or waitlisted, it works on slow 3G, and coordinates never leave the browser unless the buyer shares a delivery pin.

### T08: Delivery zones and fees (Ilorin areas)
- Seller defines zones from the **Ilorin area list in T07**: fee, minimum order, estimated time.
- Buyer's delivery address must be an Ilorin area; checkout rejects addresses outside Ilorin or in areas the seller doesn't serve.
- Delivery fee calculated on the server at checkout from the zone.
- Pickup option always available.
**Done when:** checkout shows the correct fee for each Ilorin zone and rejects unserved or non-Ilorin areas.

### T09: Delivery tracking, Phase B (status-based)
- Tables: `riders`, `deliveries`, `delivery_events`.
- Delivery statuses: `awaiting_dispatch, assigned, picked_up, in_transit, arrived, delivered, failed_attempt, returned`.
- **Seller dispatch board:** active deliveries by status, assign rider, one-tap status updates, filters.
- **Riders list:** name, phone, vehicle, active/inactive.
- **Public tracking page** `/track/<unguessable-token>`: order summary without sensitive data, timeline with timestamps, rider first name with tap-to-call or WhatsApp, estimated window, store contact, small map with store and drop-off pins.
- **Proof of delivery:** OTP shown to buyer and entered by the rider, or a photo upload.
- Failed delivery reasons and reschedule.
- Pre-filled WhatsApp click-to-chat links at key status changes. No auto-sending.
- Access rules so each seller only sees their own data.
**Done when:** an order can go from placed to delivered with a buyer-visible timeline and proof of delivery.

### T10: Analytics and admin dashboard
- Events: `store_created, store_published, product_added, stock_updated, cart_item_added, checkout_started, order_created, order_confirmed, delivery_assigned, delivery_completed, booking_created, store_link_shared, qr_downloaded, buyer_enquiry`.
- Owner-only dashboard: stores created, published, weekly active; setup completion; stores with at least one order; 30-day retention; order count and ₦ value; delivery on-time rate; per-city breakdown.
- "Weekly active" means the store did at least one of: add or update product, update stock, process an order, update a delivery.
**Done when:** the dashboard renders from real events.

### T11: Plans and gating (billing off)
- Plan config: Starter (free), Emirates Plus, Business Pro, with configurable prices.
- `hasFeature(store, key)` helper; gate CRM, rider and dispatch tools, reports and custom domain.
- No billing code. Do not change the "free POS and staff" promise without asking the owner.
**Done when:** features can be switched per plan from config.

### T12: Light CRM and seller analytics
- Customers from orders: name, phone, order count, total spent, last order, notes, repeat badge, one-tap WhatsApp.
- Seller analytics: sales this week, top products, low stock, returning customers, orders by source, cart-to-order conversion.
**Done when:** a seller sees their repeat customers and top products.

### T13: Trust basics
- Reviews only from real orders or bookings, enforced server-side.
- Blue-tick rule matches the code; admin revoke tool.
- Report store / report review and a simple moderation queue.
- Cancellation, refund and dispute text at checkout and in Terms.
- Hide Rankings and marketplace-wide claims until a city has 50 or more active stores; show a city-filtered Discover list instead.
**Done when:** reports reach a moderation queue and reviews can't be left without an order.

### T14: Quality and scale hardening
- Image compression and lazy loading; Lighthouse mobile 90+ on landing and store pages.
- Pagination and indexes on store, city, status and date.
- Rate limits on signup, orders, reviews, reports and tracking endpoints.
- Error tracking, empty and error states on every list, accessibility basics (contrast, 44px tap targets, labels).
- Privacy and Terms updated to cover delivery tracking and location handling; **flag gaps for the owner, don't write legal text**.
**Done when:** a checklist in `docs/HARDENING.md` is complete.

---

## Do not build yet

- Paystack, Flutterwave or any online payment, wallets, escrow
- Live GPS rider tracking (Phase C) and logistics-provider API integrations (Phase D). These come only after real sellers use T09
- Owned rider fleet, dropshipper workflows, nationwide marketplace, ranking algorithms
- Any map or store listing outside Ilorin (other Kwara towns and other states come later, only after Ilorin hits its targets)
- Auto-sending WhatsApp messages

---

## Stop and ask the owner when

- A task needs an API key, a paid service or a domain change
- A change would delete data or alter the schema destructively
- The code contradicts what the landing page claims and the fix isn't obvious
- A decision affects pricing, the "free" promise, or legal text

---

## Final check (end of T14)

- Brand is Kwaravend everywhere, old store links still work
- No fake "live" claims; the demo is labelled
- A guest can fill a cart, order, and watch delivery status on a tracking page
- A seller can assign a rider, update status and confirm a bank transfer
- The map is locked to Ilorin, uses the Ilorin area list, and rejects or waitlists stores outside it
- The map works on slow connections
- The admin dashboard shows real weekly active stores, orders and delivery performance
- No payment gateway code exists; deferred features are flagged off, not deleted
