# Naijavend — Bug Audit & Roadmap

_Audit date: 2026-09-24 · Scope: full storefront codebase (`apps/storefront`), Supabase schema, deployment posture._
_This document is a **plan**, not a changelog — nothing here has been fixed yet unless explicitly marked otherwise._

---

## Part 1 — Bug audit findings

### 🔴 High priority (real bugs / correctness)

**B1. Stock decrement is not concurrency-safe — oversell race.**
`create-order` and `pos/charge` both do: read stock → check → `update({ stock: old - qty })`. Two simultaneous buyers (or a buyer + POS charge) can both read the same stock and both write, driving stock negative and overselling. The DB has no check constraint on `listings.stock`.
*Plan:* replace read-modify-write with a conditional SQL update (`update listings set stock = stock - $qty where id = $id and (stock is null or stock >= $qty)`) via a small RPC function, or add a `stock >= 0` check constraint + retry loop. Same fix in both routes.

**B2. Promo usage counting has the same race.**
`create-order` increments `discount_codes.usage_count` via read-modify-write. Concurrent checkouts can exceed `max_uses`.
*Plan:* single-statement increment (`usage_count = usage_count + 1`) gated by the same `max_uses` condition, in the same transaction as the order insert.

**B3. Order + order_items + stock + promo are not atomic.**
`create-order` performs ~4 separate writes with no transaction. A failure between them leaves half-written state (order without items, stock decremented but no order, promo counted but no order). Supabase JS can't do multi-statement transactions — this needs a Postgres function.
*Plan:* create `create_order_atomic(...)` RPC (order + items + stock + promo in one transaction), call it from the route. Idempotency-key cache already exists and can stay in front.

**B4. `bookings.transition` ownership is RLS-only — fine, but `bookings` lookup leaks existence.**
The route selects the booking with the seller client; if it's not theirs, RLS returns null → 404 "or not yours". That's acceptable. **The real issue:** `mock-pay` lets ANY unauthenticated caller flip ANY pending order to `paid` by guessing/knowing an order UUID (order ids appear in WhatsApp share links and analytics paths). This was flagged in the earlier audit as "known limitation" — it remains the single largest exploit on the platform today.
*Plan (already half-designed):* signature-verified Paystack webhook route behind `PAYMENTS_MODE=mock|live` env flag; `mock-pay` returns 404 in live mode. Keep the DB trigger `order_status_webhook_only` as backstop.

**B5. StaffGuard protects pages but staff-only server pages aren't re-checked server-side.**
`StaffGuard` is a client component; a staff user could render `/dashboard/settings` HTML shell before the client redirect fires, and the server layout only verifies "some seller session exists", not owner vs staff. All mutating APIs behind those pages check ownership server-side, so exploitability is low, but staff can read store data through page-level queries.
*Plan:* move the staff/owner check into `dashboard/layout.tsx` server-side (membership lookup already exists in `getStaffMembership`) and render a server-side redirect instead of a client guard.

**B6. Chat read-marker membership check is dead code.**
`chat/read` checks `if (!member)` but RLS-filtered queries return `[]` not null — so a customer can mark threads in stores they never chatted with. Impact is cosmetic (they can only touch their own marker rows), but it's broken logic.
*Plan:* fix the check to `if (!member || member.length === 0)`, or drop it entirely and rely on the `thread_id` uid-stamping.

**B7. `checkout-summary` is unauthenticated IDOR-adjacent.**
Any caller who learns an order UUID can fetch items and totals. Order ids are shared via WhatsApp links, so exposure is real but limited (no phone/name in the response).
*Plan:* accept a short HMAC token appended to the share link, or require a matching `orderId` + `last4` of phone. Low urgency but worth doing alongside the payments work.

### 🟡 Medium priority (robustness / data quality)

**B8. In-memory rate limiter is per-instance.**
Verified in load tests: bursts spread across Vercel serverless instances never trip the limit. It also resets on cold start. All the limits added this week (track 60/m, chat 20/m, AI 12/m, etc.) are best-effort.
*Plan:* Upstash Redis (@upstash/ratelimit) — swap `rateLimit()` internals, keep the same call signature so 20+ call sites don't change.

**B9. `/api/track` trusts `storeId` as valid UUID with no existence check.**
Bogus-but-well-formed ids now 404 (fixed earlier), but a valid id for a *deleted* store still 500s (FK cascade should prevent this — verify). Not urgent.
*Plan:* catch 23503 explicitly and return 404 (already done), add a 24h dedupe hash so refresh spam doesn't inflate "views".

**B10. Analytics page loads 5,000 event rows into JS for counting.**
`analytics/page.tsx` fetches raw `store_events` rows to do counting/aggregation in memory. At scale this will be slow and hit limits.
*Plan:* replace with an aggregate view (`store_events_daily` SQL view) or a count-group-by query, keep the UI unchanged.

**B11. `listings/delete` still returns HTML redirects (307) for API errors.**
POST-only now, but the route redirects to `/dashboard/listings?remove=…` — fine for the form, awkward for programmatic callers. Also the route deletes by id with RLS ownership via `listings_owner_all`, which is correct.
*Plan:* leave as-is (form consumer) or add `?format=json` support later. Cosmetic.

**B12. Search `ilike` with user input is unparameterized-adjacent.**
`q` is sanitized to 60 chars but passed into `ilike('%${q}%')` — PostgREST escapes it properly, so this is safe today, but `%`/`_` wildcards from user input can cause expensive scans.
*Plan:* escape `%` and `_` before interpolating. One-line fix, low urgency.

**B13. Empty `location_ids` semantics is implicit.**
Staff with `location_ids = []` work at every branch — enforced nowhere in the API yet (tags only affect UI display today). POS charges still succeed for any staff of the store regardless of branch tags.
*Plan:* either enforce tags in POS/staff APIs (staff can only charge at tagged branches) or document tags as informational only. Product decision needed.

**B14. `store_locations` — no unique `position` per store; two branches can have position 1.**
The LocationsCard computes position client-side (`existing.length ? 2 : 1`) which is wrong after deletions (Store 2 removed, adding a new one gets position 2 again while Store 1 has position 1 and old Store 3 still has position 3 — gaps and duplicates possible).
*Plan:* make position server-computed (`max(position)+1` in the RPC or route), and renumber on the UI by sorted order (UI already sorts by position, so duplicates are cosmetic today).

**B15. `gallery_urls` / `store_locations` aren't invalidated after seller edits.**
`revalidateStore()` is called after settings writes, but the new locations API (`/api/locations`) never calls it — branch changes won't appear on the public store page until the 60s ISR window lapses.
*Plan:* call `revalidateStore(slug)` after successful POST/PATCH/DELETE in `/api/locations`, and after gallery saves (already happens via `/api/settings`).

### 🟢 Low priority / hygiene

**B16.** `ThemeToggle` (marketplace) and `ThemeToggleCompact` (dashboard) + the new `DashMobileNav` toggle all duplicate the same logic in 3 places. *Plan:* extract a shared `useTheme()` hook.
**B17.** `sanitizeText` is applied inconsistently — some fields lowercase, some strip characters, some don't. *Plan:* codify rules per field type in a small schema module.
**B18.** Several routes (`chat/*`, `bookings/transition`, `orders/transition`, `discounts`, `listings/*`) have no rate limits at all. *Plan:* cheap to add once B8 lands, since Redis makes them meaningful.
**B19.** `README`/docs are stale relative to the Google-only auth and free-tier changes. *Plan:* rewrite once the roadmap below settles.
**B20.** No automated tests exist for any of the auth/routing/RLS flows verified manually this week. *Plan:* see R6 below.

---

## Part 2 — Roadmap (planned, not built)

Ordered by impact; each item lists scope and why.

### R1 — Payments cutover (kills B4, B7)  ·  *highest priority*
- Paystack webhook route with HMAC-SHA512 signature verification
- `PAYMENTS_MODE=mock|live` env switch; mock-pay disabled in live mode
- Charge handoff: checkout page → Paystack inline checkout → webhook marks paid
- Order-share links get HMAC tokens (also fixes B7)
- Keep DB trigger as final authority

### R2 — Data-integrity hardening (kills B1, B2, B3, B14)  ·  *high*
- `create_order_atomic` Postgres RPC (order + items + stock + promo in one transaction)
- Conditional stock decrement + `stock >= 0` constraint
- Atomic promo increment gated by `max_uses`
- Server-computed branch `position`; renumber endpoint if needed

### R3 — Real rate limiting (kills B8)  ·  *high*
- Upstash Redis backend, same `rateLimit(key, limit, window)` signature
- Add limits to the currently-unlimited routes (chat GET/POST, transitions, discounts, listings CRUD)

### R4 — Server-side staff/role enforcement (kills B5, B13)  ·  *medium*
- Layout-level owner/staff resolution, delete client-side StaffGuard redirect
- Decide + enforce branch-tag semantics in POS/staff APIs

### R5 — Analytics efficiency (kills B9, B10)  ·  *medium*
- `store_events_daily` SQL view; dashboard reads aggregates
- Track-page view dedupe (per IP+store per day)

### R6 — Test harness (kills B20)  ·  *medium, do after R2*
- Vitest unit tests for pure helpers (hours, money, sanitize)
- Playwright smoke: sign-in → PKCE callback → dashboard redirect, buyer order flow, POS charge, settings save
- A `predeploy` npm script running typecheck + smoke against staging

### R7 — Product polish backlog
- Shared `useTheme()` hook (B16)
- Notification digest for sellers (new order/booking → WhatsApp or email summary)
- Store-site JSON-LD: include branch locations as `department` entries
- Mobile drawer: icons per nav item (parity with desktop sidebar)
- Migrate remaining email-based demo users (`@demo.test`) or delete them

---

## Part 3 — AI roadmap (researched, not built)

_Naijavend already has an AI abstraction: `packages/ai` exposes `aiComplete()` behind an `AiProvider` interface (currently a deterministic "dummy" provider) with features `store_setup`, `listing_description`, `style_store`, and every call logged to `ai_usage_log`. The plan below keeps that architecture: each new feature is an `AiFeature` enum entry + a provider method + a server route + a UI hook, so a real LLM/image provider can be swapped in without touching call sites._

### Foundation first (AI-0, prerequisite for everything below)
- **Real provider adapter.** Implement `OpenAiProvider` / `AnthropicProvider` behind `AiProvider`; pick via `AI_PROVIDER` env. Model: GPT-4o-mini or Claude Haiku class for text (cheap, fast), DALL·E 3 / Flux-class for images.
- **Image provider adapter.** New `AiImageProvider` interface (`generate(prompt, opts) → url`) alongside `AiProvider`.
- **Usage metering.** Extend `ai_usage_log` with `tokens_in/tokens_out/feature/cost_estimate`, plus per-store monthly quota (e.g. N free generations, then paid). Every route gets the same 429-with-quota path.
- **Moderation.** All generated text/images pass a cheap moderation check before returning (protects the marketplace brand).
- **Prompt library.** Prompts live in `packages/ai/src/prompts.ts` as versioned constants (not inline strings) so they're testable and improvable without code changes.

### AI-1 — AI imagery for listings & socials (the seller's biggest ask) · *high*
The "AI images to post on social media when I have a new listing" feature, plus what the research says the leaders (Shopify Magic, Instant/Blend, Pebblely) ship:
- **Background replacement / studio shots.** Seller uploads one phone photo of a product; AI replaces the background with a clean studio scene, lifestyle context (market stall, salon interior, cake table) or branded gradient. Output in 3 preset aspect ratios: 1:1 store card, 9:16 WhatsApp status/story, 16:9 hero.
- **Social post kit per listing.** One tap on a new listing generates a ready-to-post bundle: WhatsApp status image + caption, Instagram caption + hashtags (Nigerian-context tags), X post, and a WhatsApp broadcast blurb. Rendered as downloadable images with the store's logo/colours baked in (canvas render server-side).
- **Listing photo enhancement.** Auto brightness/contrast/background cleanup on any uploaded listing photo (no generative change to the product itself — keeps trust).
- **Where it hooks in:** the listing editor gets a "✨ Create social kit" button after save; the generated kit is stored (`listing_media_kits` table) and re-downloadable from the listings page.

### AI-2 — Smart marketing assistant · *high*
- **Ad copy generator.** From a listing or store profile, generate 3 ad variants (short punchy, storytelling, offer-led) sized for Instagram/Facebook/X specs — copy only, so no image-provider dependency.
- **Announcement & promo writer.** In the existing Announcement card: AI drafts the promo line from a one-sentence brief ("weekend delivery discount in Lekki").
- **Broadcast composer.** Monthly or event-based WhatsApp broadcast draft to past customers (via click-to-chat links, respecting WhatsApp's no-spam rules — text only, links generated per customer).
- **Posting calendar suggestions.** Based on the store's category and listing history, suggest a weekly rhythm (e.g. cake studio: Fri status photo, Sun new-flavour post) — static rules engine at first, LLM later.

### AI-3 — Conversational sales (the WhatsApp superpower) · *high, differentiator*
Nigeria's commerce runs on WhatsApp — the research consistently shows AI chatbots there drive 24/7 conversion (flowcart, TextYess, Chati all sell exactly this to small businesses):
- **AI reply suggestions in Naijavend chat.** Not a bot — the seller stays human. When a buyer message arrives, AI drafts 2–3 contextual replies (price, availability, delivery info pulled live from the store's listings) for one-tap send.
- **Out-of-hours auto-responder (opt-in).** If the seller enables it, unanswered buyer chats get a helpful auto-reply built from the store's real catalogue + hours, with the promise "the owner will reply in the morning." Always labelled as automated; never closes a sale by itself.
- **Buyer-side store Q&A.** On the store site, an "Ask about this product" mini-assistant grounded strictly in that store's listing data (prices, stock, hours, delivery info) with a hard refusal + WhatsApp handoff for anything else — no hallucinated prices ever.

### AI-4 — Intelligence for the seller · *medium*
- **Demand signals.** Weekly digest: which listings get views but no orders (price/description problem), best day/hours for the store's audience, top referrers already tracked in analytics — LLM writes the narrative, SQL does the math.
- **Smart recommendations for buyers.** "Customers also viewed" on listing pages using co-view signals from `store_events` (no LLM needed initially — cosine similarity on view co-occurrence).
- **Review reply drafts.** When a rating arrives, AI drafts a short thank-you/fix-it reply the seller can post. Negative reviews get a calm, professional template.
- **SEO blurb per store.** Generated meta description + FAQ schema (3–5 real questions from chat history) for better Google visibility of store sites.

### AI-5 — Later / speculative
- **Dynamic pricing suggestions** (researched: standard at enterprise, plausible for later): suggest price bands from category demand signals *inside Naijavend's own marketplace data* — only viable once there's real transaction volume; never automatic.
- **Inventory forecasting** for stocked products ("you'll run out of item X in ~10 days based on the last month") — same data-volume caveat.
- **Voice-first onboarding** for sellers who'd rather talk than type (Whisper-class STT → the existing store_setup flow).
- **AI-generated bundle ideas** ("buy A + B together" from co-purchase data) once order data is dense.

### AI sequencing & guardrails
- Order: **AI-0 → AI-1 → AI-2 → AI-3 → AI-4 → AI-5.** AI-1 is first because it's the most-demanded and demo-able; AI-3 is the strategic moat.
- Cost control: every feature rides the AI-0 quota/metering; image generation is 10–20× text cost, so social kits are capped per store/month.
- Trust rules: no AI-generated product imagery that changes the product itself; auto-replies always labelled; Q&A grounded in real catalogue data only.
- Fits R6: each AI feature ships with a test using a mocked provider — the `AiProvider` interface makes this trivial.

### Suggested AI sequencing
`AI-0 → AI-1 → AI-2 → AI-3` (AI-4/AI-5 follow once usage data accumulates). AI-0 can start in parallel with R2/R3 since it only touches `packages/ai`.

---

### Full sequencing (Parts 2 + 3 combined)
`R2 → R3 → R1 → AI-0 → AI-1 → AI-2 → R4 → R5 → AI-3 → R6 → AI-4 → R7 → AI-5`
(Infrastructure and trust-and-safety rails first, the highest-demand seller features next, intelligence last — AI features inherit the quota/metering rails and the analytics data they need.)

---

## Verification status of this audit
- Findings B1–B3, B13–B15 come from code read this session (`create-order`, `pos/charge`, `locations`, `staff`, `StaffGuard`, `chat/read`, `analytics`).
- B4/B7/B8/B10 were confirmed in the earlier security audit + live load tests (Upstash-style fix already proposed there).
- B6 was confirmed by reading RLS semantics (`chat_read_state` policy returns empty arrays, not nulls).
- Nothing above has been fixed yet — next session should start at R2.
