# Shopify-Style Store Builder — Research & Refined Plan

Note: this overlaps directly with **iDevTenancy** in the IDEV Suite, already positioned as a Shopify competitor. Everything below assumes it's shaping that product, not a separate 10th venture — flag if that's wrong.

## Bottom line, up front

This market is not empty, and it's not even under-served in Nigeria specifically — it's arguably the most contested SaaS category in Nigerian tech right now, with a dominant local incumbent that already does most of what you listed. The genuine openings are narrower than "AI builder + social ads + maps + WhatsApp bots + ratings," and several of those five features are better integrated from a specialist than built from scratch.

---

## 1. Competitive landscape

**Global:**
- **Shopify** — the platform being copied. Strong globally, weak for Nigerian merchants specifically: Shopify Payments isn't available in Nigeria, so Paystack/Flutterwave require a third-party app and manual API setup, USD pricing ($29-299/month) is a real barrier at Naira exchange rates, and setup is described by reviewers as "not a weekend project" for a first-time Nigerian seller.

**Nigeria-focused (the real competitive set):**

| Player | Position | Pricing |
|---|---|---|
| **Bumpa** | Dominant mobile-first Nigerian Shopify alternative. Inventory, staff coordination, analytics, integrates directly with Flutterwave, no API-key setup required. Reviewed as the default recommendation over Shopify for Nigerian merchants | ₦5,000-10,000/month |
| **Catlog** | Built specifically for sellers running their business through social media (link-first, social-commerce style), not a full storefront-first model. Available across Nigeria, Kenya, South Africa, Ghana | — |
| **Payxy** | Nigeria-focused, card/transfer/USSD collection, positions around 17-currency support | — |
| **QShop** | DIY store creation for SMEs, multi-African-market | — |
| **Flutterwave Store, Storefront Africa** | Lighter-weight: product catalogue + payment link, fast to start, thin on features | — |
| **WooCommerce** | Full control, but needs a developer (₦200,000-800,000 for a functional store) | Free + dev cost |

**AI store builders (a feature, not a company, at this point):** Shopify Magic, Wix ADI, Hostinger AI, 10Web, and third-party tools like DropMagic all generate a store from a text prompt or product URL now — this is table stakes on every serious platform in 2026, not a differentiator by itself. Industry estimate: AI gets you roughly 70% of a functional store (layout, navigation, draft copy); product photography, pricing strategy, and payment/shipping configuration still need a human.

**WhatsApp commerce bots — its own crowded specialist category:** Wati, Trengo, RheoChat, BotNaija, and several others already sell exactly "AI WhatsApp bot for Nigerian SMEs" as their entire product — catalog sync, Paystack/Flutterwave-linked checkout links, cart-abandonment recovery, Nigerian Pidgin support. This is not a gap; it's a feature you'd be building in direct competition with companies whose whole business is this one thing.

## 2. Where the actual openings are

- **Bumpa owns "easy mobile-first store for a Nigerian social seller."** Beating them head-on with the same positioning is fighting the category leader on their own turf with a decade less runway.
- **Nobody in the Nigerian-focused list is strong on services, not just products.** Bumpa/Catlog/Payxy read as product-inventory-first. A builder aimed at **service businesses** (salons, tutors, consultants, event vendors — booking + deposit-taking + location, not SKU/inventory management) is a genuinely different shape of tool than what dominates this list.
- **Ratings/reviews tied to a real map location** is under-built in this set — most of these platforms are storefront-and-checkout tools, not discovery tools. A store builder where every store also gets a public, ratable, mappable profile (closer to a mini Google-Business-Profile-plus-storefront) is a distinct angle from "build a checkout page."
- **AI builder and social ad generation are expected features, not moats.** Every serious competitor either has them or will within a year (Adobe's 2026 forecast: 75% of new digital stores will use AI as a core design/merchandising tool). Build them because merchants now expect them, not because they win the category.

## 3. What's wrong with the current shape of the plan

Same pattern as the last two ideas: **AI store builder + social ad generation + ratings + Google Maps + WhatsApp bots + full storefront + payments**, all in an MVP, run by one person, is six product categories where established, funded, single-purpose competitors already exist in five of them. This isn't a reason to abandon it — it's a reason to sequence it hard, and to *integrate* rather than *build* in the categories where a specialist already does it well and cheaply.

**Build vs. integrate, feature by feature:**

| Feature | Recommendation |
|---|---|
| AI store builder (prompt → store layout/copy) | Build a thin version — table stakes, but doesn't need to match Shopify Magic's depth at MVP. A single "describe your business, get a working store draft" flow is enough to start. |
| Social ads for stores/services | **Integrate**, don't build from scratch: Meta's own Advantage+ ad tools already do AI-generated ad creative and targeting well. A "publish to Instagram/Facebook ad" button that hands off to Meta's ad manager with pre-filled product data is far cheaper than building an ad-creative AI engine, and won't be worse. |
| Ratings | Build — it's a straightforward feature (see schema below), and it's a real point of difference against the current Nigerian competitor set. |
| Google Maps / location | Build, using the Google Maps Platform API directly — well-documented, not a big lift, and genuinely useful for the "service business with a physical location" angle above. |
| WhatsApp bots | **Integrate, don't build a general-purpose AI bot engine.** Start with WhatsApp Business API's native catalog + click-to-chat button (low effort, real value), and consider a lightweight rules-based order-taking flow before attempting the natural-language AI agent that Wati/RheoChat/BotNaija already specialize in. Nigeria's Data Protection Act 2023 also applies here — any WhatsApp marketing messages need clear opt-out handling ("Reply STOP"), which is cheap to build in but easy to forget. |

## 4. Refined wedge and MVP scope

**Positioning:** a store-and-service builder for Nigerian sellers who don't fit neatly into "physical product with inventory" — service providers, appointment-based businesses, hybrid product+service sellers — with a public, mappable, ratable profile page, and an AI-assisted setup flow.

**MVP (build this first, roughly 10-14 weeks solo):**
1. Self-serve signup, AI-assisted store setup ("describe your business" → draft store page)
2. Product/service catalog (supports both physical items and bookable services)
3. Public store page: photos, description, location pin (Google Maps embed), ratings/reviews
4. Paystack/Flutterwave checkout — same non-negotiable local-payment integration every competitor above has
5. WhatsApp click-to-chat button + native catalog link (not a custom AI bot yet)
6. Basic seller dashboard: orders, ratings received, store views

**Explicitly deferred:**
- Custom AI WhatsApp conversational agent (integrate a specialist API later, or build only once you know sellers actually want it over the simple click-to-chat version)
- In-house social ad creative generation (hand off to Meta Advantage+ instead)
- Multi-currency, multi-country expansion
- Staff/team accounts, advanced inventory (Bumpa's territory — don't compete there directly at MVP)

## 5. Tech stack

Consistent with your usual choices ([[tech-stack]]) and the pattern from the EdTech blueprint:
- **Web + mobile from one codebase:** Expo (React Native) + `react-native-web` if you want the same cross-platform approach as the STEM app, or Next.js if this is meant to feel more like a classic storefront-builder web product — worth deciding based on whether sellers will mostly set up stores from a phone (favors RN) or a laptop (favors Next.js). Bumpa's own positioning ("build and manage from your phone") suggests RN is the better call here.
- **Backend:** Supabase (Postgres + Auth + Storage + Edge Functions), same reasoning as before.
- **Maps:** Google Maps Platform (Places API for address autocomplete, Maps SDK for the store-locator embed).
- **Payments:** Paystack primary (matches what Bumpa and most competitors lead with), Flutterwave as a second option.
- **AI:** Claude, server-side, for the store-setup draft generator and product description writing — same cost-logging pattern as the EdTech plan.

## 6. Business model

Anchor pricing against Bumpa's known ₦5,000-10,000/month rather than Shopify's dollar pricing — that's the real comparison a Nigerian seller will make. A free tier (limited products/services, platform branding) into a paid tier once a seller has real sales flowing is the standard, proven shape here — don't reinvent the pricing model, the market's already validated it.

## 7. Before building further

- Decide explicitly: is this iDevTenancy, or separate? If it's iDevTenancy, check what's already been decided/built for it before this doc creates conflicting direction.
- Talk to 5-10 Nigerian service-based sellers (not product sellers — that's Bumpa's proven turf) about whether "store + booking + map + ratings" solves something Bumpa/Catlog/Instagram-only currently don't.
- Confirm Google Maps Platform pricing at your expected usage (it's pay-per-use past a free tier — cheap at low volume, worth modeling before committing).
