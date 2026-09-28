# iDevTenancy — Build Blueprint

"Local Shopify for Nigerians" — store + service builder with AI-assisted setup, ratings, map presence, and WhatsApp storefront links. Built as part of the IDEV Suite, so it uses shared suite infrastructure ([[idev-suite]]) rather than standing up its own auth/AI stack from scratch.

Scope recap from the research doc: lead with **service businesses + product sellers who want a public, ratable, mappable store page**, not a head-on inventory-management fight with Bumpa. AI store builder and Google Maps are built in-house; social ads and WhatsApp AI conversation are integrations, not custom builds, at MVP.

---

## 1. Fits into the IDEV Suite

- **Auth/storage:** iDevVault, not a standalone Supabase auth setup — keeps one identity system across the whole suite.
- **AI:** the shared `aiComplete` wrapper, not a separate Claude integration — same cost-tracking/prompt-management surface as the rest of the suite.
- **Billing:** shared billing rails already defined for the suite — Paystack/Flutterwave integration should plug into that rather than iDevTenancy inventing its own payment layer.
- **Brand:** electric cyan `#22D3EE`, signal violet `#A78BFA`, amber `#F59E0B` on deep navy dark theme; Space Grotesk (headings), Inter (body), JetBrains Mono (code/receipts/order IDs).

If any of the above shared pieces don't yet support what's needed here (e.g. iDevVault doesn't yet handle multi-tenant store ownership), that's a suite-infrastructure task to flag before iDevTenancy-specific work, not something to route around with a parallel system.

---

## 2. Tech stack

| Layer | Choice | Why |
|---|---|---|
| Seller app (store management, on-the-go) | Expo (React Native) | Matches how Bumpa's own positioning works — Nigerian sellers manage stores from their phones; matches the RN direction from the STEM app too |
| Public storefront pages (customer-facing) | Next.js (SSR/SSG) | Public store pages need to be fast, shareable links, and indexable by Google — this is the one place in the suite where React Native Web is the wrong tool, since RN-rendered pages don't SEO well and a customer clicking a WhatsApp-shared store link needs an instant, lightweight page, not an app shell |
| Backend | iDevVault + Postgres (via suite's existing backend, not a new Supabase project) | Suite consistency |
| Maps | Google Maps Platform (Places Autocomplete + Maps SDK/Static Maps API) | |
| Payments | Suite's shared billing rails, backed by Paystack primary / Flutterwave secondary | |
| AI | `aiComplete` wrapper | Store-setup draft generator, product/service description writer |
| Social ads | Meta Advantage+ handoff (deep link with pre-filled product data), not a built ad-creative engine | Per research doc — don't compete with Meta's own tooling |
| WhatsApp | WhatsApp Business API click-to-chat + native catalog link at MVP; defer a custom AI conversational agent | Per research doc — Wati/RheoChat/BotNaija already specialize here |

---

## 3. Database schema

```sql
-- Tenancy — one row per store/seller
stores (
  id uuid pk,
  owner_id uuid references users(id),        -- from iDevVault
  name text,
  slug text unique,                          -- for the public URL: idevtenancy.com/s/{slug}
  business_type text,                        -- 'product','service','hybrid'
  description text,
  ai_generated_description boolean default false,
  logo_url text,
  address text,
  latitude numeric,
  longitude numeric,
  whatsapp_number text,
  plan text default 'free',
  created_at timestamptz default now()
)

-- Catalog — covers both physical products and bookable services
listings (
  id uuid pk,
  store_id uuid references stores(id),
  type text check (type in ('product','service')),
  title text,
  description text,
  ai_generated_description boolean default false,
  price_kobo bigint,
  is_bookable boolean default false,          -- true for services needing appointment slots
  image_urls jsonb,
  created_at timestamptz default now()
)

-- Bookings (services)
bookings (
  id uuid pk,
  listing_id uuid references listings(id),
  customer_name text,
  customer_phone text,
  slot_start timestamptz,
  slot_end timestamptz,
  status text check (status in ('pending','confirmed','completed','cancelled')),
  deposit_paid_kobo bigint default 0,
  created_at timestamptz default now()
)

-- Orders (products)
orders (
  id uuid pk,
  store_id uuid references stores(id),
  customer_name text,
  customer_phone text,
  total_kobo bigint,
  status text check (status in ('pending','paid','fulfilled','cancelled')),
  payment_reference text,
  created_at timestamptz default now()
)

order_items (
  id uuid pk,
  order_id uuid references orders(id),
  listing_id uuid references listings(id),
  quantity integer,
  unit_price_kobo bigint
)

-- Ratings — tied to the store, optionally to a specific order/booking
store_ratings (
  id uuid pk,
  store_id uuid references stores(id),
  customer_phone text,                        -- no account required to rate; phone is the identity check
  order_id uuid references orders(id),
  booking_id uuid references bookings(id),
  stars integer check (stars between 1 and 5),
  comment text,
  created_at timestamptz default now()
)

-- AI usage tracking (via aiComplete, logged per suite convention)
ai_usage_log (
  id uuid pk,
  store_id uuid references stores(id),
  feature text,                               -- 'store_setup','listing_description'
  tokens_used integer,
  created_at timestamptz default now()
)

-- WhatsApp click-to-chat config (not a bot — just structured metadata for the link/catalog)
whatsapp_settings (
  store_id uuid references stores(id) primary key,
  business_number text,
  greeting_message text,
  catalog_enabled boolean default false
)
```

**RLS shape:** store data scoped to `owner_id` matching the authenticated seller (via iDevVault's identity, not a parallel auth system). Public storefront pages read through a public, rate-limited read path keyed by `slug` — no auth required for a customer to view a store or leave a rating.

---

## 4. API / Edge Functions

| Function | Purpose |
|---|---|
| `ai-generate-store-draft` | Takes a short business description, returns a draft store name/description/category via `aiComplete` |
| `ai-generate-listing-description` | Same pattern, scoped to one product/service |
| `create-order` | Validates listing prices server-side (never trust client-submitted totals), creates `orders`/`order_items`, returns a payment link from the suite's billing rails |
| `payment-webhook` | Receives the payment provider's webhook (via suite billing rails), marks `orders.status = 'paid'` — the only thing allowed to do so |
| `create-booking` | Validates slot availability before writing to `bookings` |
| `submit-rating` | Validates the `order_id`/`booking_id` actually belongs to that store before accepting a rating, to prevent fake reviews from unrelated visitors |
| `whatsapp-link-builder` | Generates the pre-filled `wa.me` click-to-chat link with store/listing context baked into the message |

---

## 5. AI integration

Two features at MVP, both via `aiComplete`, both logged in `ai_usage_log`:

1. **Store setup draft** — seller types a couple of sentences about their business, gets a draft store name, description, and suggested category back. Editable before publishing, never auto-published without seller review.
2. **Listing description writer** — same pattern per product/service, optionally takes a photo (if `aiComplete` supports vision) to help draft the description.

Deferred: AI-generated social ad creative (use the Meta handoff instead), AI WhatsApp conversational agent (integrate a specialist provider later if sellers actually ask for it beyond click-to-chat).

---

## 6. Seller app structure (Expo/React Native)

```
apps/idevtenancy-seller/
  App.tsx
  src/
    api/
      idevVaultClient.ts
      aiComplete.ts
    screens/
      OnboardingScreen.tsx        -- AI-assisted store setup flow
      DashboardScreen.tsx
      ListingsScreen.tsx
      ListingEditorScreen.tsx
      OrdersScreen.tsx
      BookingsScreen.tsx
      RatingsScreen.tsx
      StoreSettingsScreen.tsx     -- location/map pin, WhatsApp number, branding
    components/
      ListingCard.tsx
      RatingStars.tsx
      MapPinPicker.tsx
      OrderStatusBadge.tsx
    navigation/
      RootNavigator.tsx
    store/
      useSessionStore.ts
    theme/
      colors.ts                   -- IDEV brand tokens
      typography.ts
```

## 7. Public storefront structure (Next.js)

```
apps/idevtenancy-storefront/
  app/
    s/[slug]/
      page.tsx                    -- public store page: listings, map, ratings
      listing/[listingId]/page.tsx
      book/[listingId]/page.tsx   -- booking flow for services
    checkout/
      [orderId]/page.tsx
    api/
      (webhook handlers if not covered by suite Edge Functions)
  components/
    StoreHeader.tsx
    ListingGrid.tsx
    RatingSummary.tsx
    MapEmbed.tsx
    WhatsAppButton.tsx
  lib/
    idevVaultClient.ts
  styles/
    globals.css
```

---

## 8. Pages — full list

**Seller app (mobile):**
1. Onboarding / AI store setup
2. Dashboard (orders, bookings, ratings at a glance)
3. Listings management
4. Listing editor (with AI description assist)
5. Orders
6. Bookings/calendar (for service-type stores)
7. Ratings received
8. Store settings (location pin, WhatsApp number, branding, plan/billing)

**Public storefront (web):**
9. Store page (listings, map, ratings, WhatsApp button)
10. Listing detail page
11. Booking flow (services)
12. Checkout / order confirmation
13. Store discovery/search page (browse stores by location or category — worth having even at MVP, since it's what makes the "map presence" feature actually useful beyond a single store's own page)

---

## 9. Suggested build phasing

1. Store creation + AI setup draft + listings (no payments/bookings yet) — get sellers publishing pages
2. Public storefront pages + Google Maps embed + WhatsApp click-to-chat
3. Orders + payments (via suite billing rails)
4. Bookings (service-type stores)
5. Ratings
6. Store discovery/search page
7. Meta Advantage+ handoff for ads

---

## 10. Open questions

- Does iDevVault currently support multi-tenant "store ownership" as a concept, or does that need to be added to the shared auth layer first?
- Does `aiComplete` support image input (for photo-based listing descriptions), or is that a text-only wrapper today?
- Confirm which of Paystack/Flutterwave the suite's shared billing rails are already built against, so this doesn't duplicate integration work.
