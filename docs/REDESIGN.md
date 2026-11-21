# REDESIGN.md: Redesign and implement T01 to T14

App: **Kwaravend**. Launch region: **Ilorin, Kwara State only**.

This file extends `BUILD.md`. Read `BUILD.md` and `KWARAVEND_IMPROVEMENTS.md` first.

---

## 0. Precedence (read this first)

`BUILD.md` says what each task must do. **This file says how it must look, feel and be engineered**, and changes a few visual rules.

**This file wins on:** visual design, layout, the landing page structure (replaces the "under about 6 short sections" rule in T02), the map page layout (extends T07), component rules, and engineering standards.

**`BUILD.md` and `KWARAVEND_IMPROVEMENTS.md` still win on:**
- Honesty: no fake stats, testimonials, stores or reviews. The demo stays labelled "Example store / Sample data".
- Payments deferred: no Paystack or any payment processor.
- Ilorin-only map and stores. No other city is shown.
- Privacy: buyer location stays in the browser. No live people locations on any public map.
- Do not delete features; hide with flags.
- Prices, stock and totals computed on the server.
- Stop and ask the owner for API keys, paid services, domain changes, destructive data changes, or pricing and legal decisions.

**Performance is a requirement, not a nice-to-have.** Many sellers and buyers use mid-range Android phones on mobile data. Every visual feature below has a lighter fallback (section 4.3). If a fancy effect can't run smoothly on a mid-range phone, it must switch itself off.

---

## 1. How to work

1. Do **R0 and R1 first** (section 9), then show the owner the design foundation before building pages.
2. One task at a time, in the order in section 9. Small commits: `R03: build landing scene engine`.
3. After each task: lint, type-check, unit tests, build, and the relevant Playwright test. Then report: what changed, how to test it (3 to 5 steps), what is not done or uncertain, and screenshots of changed screens at 390px and 1280px wide.
4. Do not assume the stack. The T00 audit decides which libraries below fit. Where this file names a library, it is the default recommendation; if the repo already has an equivalent, keep that and say so.
5. Check each new dependency's licence (must allow commercial use) and its size in the production bundle before adding it. Pin exact versions.
6. Never invent assets. Draw illustrations in code or as original SVG. Do not copy Snapchat's, Bolt's or anyone's artwork, pins, avatars, logos or app UI.

---

## 2. Design foundation (R1)

Build these before any page. Document everything in `docs/DESIGN.md` and a component playground (Storybook or Ladle).

### 2.1 Design tokens
- Single source of truth (CSS variables, generated from a tokens file): colour, typography, spacing (4px scale), radius, shadow, blur, border, opacity, motion (duration and easing), **z-index scale**, and a **depth scale** used by the landing scene (section 4).
- **Light and dark themes** from the start. Follow the system setting, with a manual toggle. Every component and the map style must have both.
- Palette: **use the colour scheme in section 2.6. It is decided.** Do not propose alternatives unless the owner asks. Keep every value as a token, so the scheme can change in one file.
- Contrast: WCAG 2.2 AA minimum for text and interactive elements.

### 2.2 Typography
- One display font and one text font, **self-hosted**, subset, variable where possible, `font-display: swap`, preload only the one used above the fold.
- Must render Nigerian names and the naira sign (₦) correctly. Test with Yoruba diacritics.
- A fluid type scale (clamp) with tokens for display, heading, body, caption, and tabular numerals for prices.

### 2.3 Icons: no emojis anywhere in the UI
- Use **one** icon set (default: Lucide; Phosphor or Tabler are acceptable if the owner prefers). Inline SVG, tree-shaken, no icon fonts.
- Create one `Icon` component: sizes 16, 20, 24, 32; consistent stroke width; `aria-hidden` unless it carries meaning; always paired with visible text or an `aria-label`.
- **Replace every emoji** in components, copy, seed data, category lists, empty states, toasts, emails, OG images and the demo store. Keep user-generated content as the user typed it, but the app's own UI must contain zero emojis.
- **Category icon map** in one file (`categories.ts`): id, label, icon, colour. Suggested icons: food (utensils), cakes (cake-slice or cupcake), beauty (sparkles), braids and hair (scissors or comb), fashion (shirt), accessories (gem), phones and gadgets (smartphone), groceries (shopping-basket), home services (wrench), tutors (graduation-cap), other (store). Use the nearest available icon in the chosen set.
- Add a **lint or CI check** that fails the build if an emoji or pictographic Unicode character appears in `src/` outside user-content fixtures.
- WhatsApp pre-filled messages: plain text, no emojis (they can break across devices).

### 2.4 One button system and one category-chip system
The owner wants every button and every category control to look and behave the same everywhere.

- **`Button`**: variants `primary`, `secondary`, `tertiary` (ghost), `destructive`, `link`; sizes `sm`, `md`, `lg` (touch target at least 44px on mobile); optional leading and trailing icon; `fullWidth`; states: default, hover, focus-visible, pressed, loading (spinner, keeps width), disabled.
- **`IconButton`** (always with an accessible name and tooltip) and **`FAB`** (floating action button, for the map) built on the same base.
- **`Chip`** for **all categories and filters** (landing, Discover, map, dashboard filters): same height, radius, icon slot, selected style, count badge, and keyboard behaviour everywhere. Also `SegmentedControl`, `Badge`, `Tag`, `Toggle`.
- **No raw `<button>` or ad-hoc styled buttons.** Add a lint rule banning them outside the component library.
- One focus ring style across the app. One pressed-state animation (scale 0.97 with a short ease).
- Document every component in the playground with all states, light and dark, and an automated accessibility check (axe).

### 2.5 Layout and motion
- Breakpoints: 360, 480, 768, 1024, 1280. Mobile first. Respect safe-area insets (notches, home bar).
- Mobile app shell: bottom navigation for buyers and for sellers (different items). Desktop: left rail for the seller dashboard.
- Motion tokens (durations 120, 200, 320, 500 ms; standard, emphasised and spring easings). Animate **transform and opacity only**. No layout-shifting animation. Honour `prefers-reduced-motion`.
- Skeleton loaders (not spinners) for lists and cards. Designed empty states, error states and offline states for every screen, with an icon, a plain sentence, and one clear button.

### 2.6 Colour scheme (decided)

**Direction:** dark-first, glassy and vivid, with a matching light theme. A fresh **emerald** as the brand colour and a warm **sun amber** as the accent, on near-black green-tinted surfaces. It is original: do not use Snapchat's yellow as the brand colour. The look should feel alive on a map and readable in sunlight.

All pairs below were checked for **WCAG AA contrast** (4.5 or more for text). If you change a value, re-check it and keep the ratios.

**Dark theme (default)**

| Token | Value | Use |
|---|---|---|
| `--bg-0` | `#07110F` | Page background |
| `--bg-1` | `#0C1A17` | Large panels, map land |
| `--surface` | `#112420` | Cards, sheets |
| `--surface-raised` | `#17302A` | Popovers, hovered cards |
| `--text` | `#EAF5F1` | Main text |
| `--text-muted` | `#9DB5AD` | Secondary text |
| `--primary` | `#2BD9A0` | Brand, links, main buttons |
| `--on-primary` | `#04130E` | Text and icons on primary |
| `--accent` | `#FFB629` | Highlights, "open now" glow, promotions |
| `--on-accent` | `#1A1100` | Text on accent |
| `--success` | `#3DDC84` | Delivered, paid (confirmed) |
| `--warning` | `#FFC247` | Needs attention |
| `--danger` | `#FF6B6B` | Errors, destructive actions |
| `--info` | `#5AA9FF` | Neutral information, in transit |

**Light theme**

| Token | Value | Use |
|---|---|---|
| `--bg-0` | `#F4FAF7` | Page background |
| `--bg-1` | `#FFFFFF` | Large panels |
| `--surface` | `#FFFFFF` | Cards, sheets |
| `--surface-raised` | `#EEF6F2` | Popovers, hovered cards |
| `--text` | `#0B1F1A` | Main text |
| `--text-muted` | `#4A635B` | Secondary text |
| `--primary` | `#0A7F5A` | Brand, links, main buttons |
| `--on-primary` | `#FFFFFF` | Text on primary |
| `--accent` | `#B45309` | Highlights |
| `--on-accent` | `#FFFFFF` | Text on accent |
| `--success` | `#15803D` | Delivered, paid (confirmed) |
| `--warning` | `#8A5A00` | Needs attention |
| `--danger` | `#C62828` | Errors, destructive actions |
| `--info` | `#1D5FD1` | Neutral information, in transit |

Measured contrast: dark text on page 17.2 to 1, muted text 8.8 to 1, primary button text 10.4 to 1; light text on page 16.2 to 1, muted 6.2 to 1, primary button text 5.0 to 1. Every status colour passes 4.5 to 1 on its own theme's background.

**Category colours** (the ring on map pins, the icon in `Chip`, the badge on cards). One per category, each passes 4.5 to 1 on its theme's surface:

| Category | Dark | Light |
|---|---|---|
| Food | `#FF8A4C` | `#B45309` |
| Cakes | `#FF7EB6` | `#BE185D` |
| Beauty | `#C58BFF` | `#7E22CE` |
| Braids and hair | `#9B8CFF` | `#5B3FD1` |
| Fashion | `#5AA9FF` | `#1D5FD1` |
| Accessories | `#37D6E0` | `#0E7490` |
| Phones and gadgets | `#4ADE80` | `#15803D` |
| Groceries | `#B6E04A` | `#4D7C0F` |
| Home services | `#FFB629` | `#8A5A00` |
| Tutors | `#FF6B6B` | `#C62828` |
| Other | `#9DB5AD` | `#4A635B` |

Never rely on colour alone: every category and status also has its **icon and text label**.

**Glass surfaces (glassmorphism)**
- Dark: background `rgba(255,255,255,0.06)`, border `1px solid rgba(255,255,255,0.12)`, `backdrop-filter: blur(16px) saturate(140%)`, plus a faint top highlight. Light: background `rgba(255,255,255,0.72)`, border `rgba(11,31,26,0.08)`, same blur.
- Use glass for the map's floating search pill, chips row, bottom sheet, and the landing page's floating cards. Don't use it for long text blocks or forms.
- `backdrop-filter` is expensive. **Turn it off and use the solid `--surface-raised` colour** when the device is in the lite tier (section 4.3), when `backdrop-filter` is unsupported, or when "Reduce effects" is on. Text must pass contrast on both the glass and the solid fallback.

**Gradients (decorative only)**
- **Brand sun:** `linear-gradient(135deg, #2BD9A0, #FFB629)`. Dark text (`--on-primary`) passes on both ends. Use for hero accents, the plan highlight and the story ring on pins. Never put light text on it.
- **Night glow** behind the landing hero in dark mode: a radial gradient from `rgba(43,217,160,0.18)` to transparent.
- Don't use gradients for body text or small UI text.

**Status colours for orders and deliveries** (always with an icon and label)
- Pending: warning. Confirmed: info. Preparing: accent. Ready: primary. Out for delivery: info. Delivered and completed: success. Cancelled and failed: danger. Awaiting payment confirmation: warning. Paid (confirmed by seller): success.

**Map colours** (the custom map style in section 6.3)
- Light map: land `#EEF6F2`, water `#BFE3F2`, parks `#CFEBD9`, buildings `#E3ECE7`, roads `#FFFFFF` with `#D5E4DD` casing, labels `#0B1F1A`.
- Dark map: land `#0C1A17`, water `#0F2A3A`, parks `#123026`, buildings `#14281F`, roads `#1B3A33`, labels `#EAF5F1`.
- Heat layer: transparent to `--primary` at about 35% opacity, through `--accent`, to `--danger` at the hottest cells. Selected pin: `--accent` ring. Open-now pulse: `--accent`.

**Rules**
- Implement as CSS variables from the tokens file; components reference tokens only, never hex values. Add a lint rule that fails on raw hex colours outside the tokens file and the map style.
- The theme follows the system setting, with a manual toggle, and remembers the choice (in try/catch storage). No flash of the wrong theme on load.
- Keep the 3D scene's lighting and materials in the same palette, so the landing page and the app feel like one product.

---

## 3. Frontend and system architecture (R2)

Write `docs/ARCHITECTURE.md` (with Mermaid diagrams) and short decision records for each major choice.

### 3.1 Frontend
- **Strict TypeScript.** Feature-sliced structure: `app/` (routing, providers), `features/<name>/` (cart, orders, delivery, map, onboarding, plans, crm, admin), `entities/` (store, product, order, customer), `shared/ui` (component library), `shared/lib` (utilities, API client, analytics, flags).
- **Data layer:** typed API client, runtime schema validation (Zod or similar) on every response, a query cache (TanStack Query or equivalent) with sensible stale times, optimistic updates for order and delivery status changes with rollback, and request deduplication.
- **Rendering:** server-render or statically generate public pages (landing, store pages, product pages) for speed and search. Hydrate interactive parts lazily. Route-level code splitting. Heavy things (map, 3D scene, charts, story viewer) are lazy chunks loaded on demand.
- **State:** server state in the query cache; small local state with hooks; a tiny store only for cart and UI preferences. Cart persists with `localStorage` in try/catch.
- **PWA:** installable, offline app shell, cached storefront pages and last-seen orders, a friendly offline banner, safe service-worker update flow (never trap users on an old version).
- **Images:** responsive sizes (`srcset`), modern formats, blurhash or dominant-colour placeholders, explicit width and height, lazy loading, upload-time compression and EXIF stripping.
- **Error handling:** error boundaries per feature, retry with backoff, user-friendly messages, error tracking.
- **i18n-ready:** all UI strings in a catalogue (English first; Pidgin, Yoruba and Hausa later). No hard-coded strings in components.
- **Accessibility:** WCAG 2.2 AA, full keyboard use, focus management in drawers, sheets and modals, screen-reader labels, live regions for status changes.

### 3.2 System design
- **Modular monolith** with clear modules: identity, catalogue, cart and orders, payments (manual only), delivery, geo, notifications, reviews and trust, analytics, admin. If the backend is a hosted database service, enforce module boundaries through a service layer and row-level access rules.
- **Invariants (enforce on the server):** totals computed from server prices; order stores a snapshot; idempotency keys on order creation; a seller can only read and write their own store's data; tracking tokens are unguessable and scoped to one order.
- **Realtime:** new-order alerts, order status and the dispatch board update live via the platform's realtime feature or server-sent events, with polling fallback. Live rider GPS stays out (Phase C).
- **Background jobs:** expire carts, expire store statuses after 24 hours, compute the map heat aggregates, send notification queues, retention cleanup.
- **Caching and CDN:** public store pages with revalidation (invalidate on seller edits); map file and assets on a CDN with range requests; immutable hashed assets.
- **Security:** input validation everywhere, rate limits (signup, orders, reviews, reports, tracking), upload validation (type, size, scan for obvious abuse), CSP and security headers, secrets only in environment variables, audit log for staff and admin actions, role-based access (owner, manager, cashier, rider, admin).
- **Observability:** error tracking, structured logs, uptime check, web-vitals reporting to an owner-only dashboard, and an alert when order creation fails.
- **Multi-city readiness (design only):** cities are config, but only Ilorin is active. Nothing in the code may hard-code Ilorin outside `MAP_CONFIG`, `BRAND` and the area seed.

### 3.3 Quality gates (CI)
- Lint, type-check, unit tests (Vitest or equivalent), component tests, **Playwright end-to-end tests** for the critical paths (create store, add product, guest cart to order, seller confirms, dispatch, buyer tracks), visual regression snapshots at 390px and 1280px, axe accessibility checks, and **Lighthouse CI** with the budgets in section 4.7.
- Pre-commit hooks for lint and format. No merging with failing checks.

---

## 4. The "/" page: a layered scene with 100 layers (R3)

### 4.1 Concept
A single continuous scroll story: **from a WhatsApp chat, to a storefront, to a doorstep in Ilorin.** The page is one scene made of **100 layers** that move at different depths as the visitor scrolls, mixing **2D**, **2.5D** and **3D**.

- **2D layer:** flat SVG, gradient, texture, text or Lottie. No depth.
- **2.5D layer:** a flat plane placed at a depth, moving with parallax, with tilt, isometric illustration, or a CSS 3D transform. It looks dimensional but is not a 3D model.
- **3D layer:** a real 3D model rendered in WebGL (three.js, optionally via react-three-fiber).

Target mix: **40 layers 2D, 40 layers 2.5D, 20 layers 3D.**

### 4.2 The layer manifest
Create `scene/layers.ts`, one entry per layer (`L001` to `L100`):

`id, name, type (2d|2.5d|3d), asset, depth (z, from the depth scale), parallaxSpeed, scrollRange (start and end), tier (lite|standard|full), interaction (none|hover|pointer|scroll), cost (low|medium|high)`.

Also generate `docs/LANDING_LAYERS.md` automatically from the manifest, so the owner can see all 100 layers, their types and their cost.

Suggested distribution (adjust sensibly; the totals are the target):

| Band | Layers | Type | Contents |
|---|---|---|---|
| A. Background | L001 to L012 (12) | 2D | Sky gradient, sun glow, clouds, haze, subtle pattern, grain, vignette, night variant for dark mode |
| B. Far city | L013 to L032 (20) | 2.5D | Ilorin-inspired skyline of low-rise rooftops, trees, hills, generic landmarks, far power lines. Do not draw real landmarks unless the owner approves |
| C. Mid street | L033 to L056 (24) | 8 2D, 12 2.5D, 4 3D | Market stalls, shop fronts, signs, parked bikes, people silhouettes, a bus, billboards, awnings, a 3D stall and 3D bikes |
| D. Hero objects | L057 to L072 (16) | 3D | Phone showing a store page, storefront stall, delivery scooter and rider, floating map pins, cart, parcel boxes, order tag |
| E. Interface layers | L073 to L088 (16) | 8 2D, 8 2.5D | Floating cards (new order, status chips, rating stars), icon bubbles, connector lines, step markers |
| F. Foreground | L089 to L100 (12) | 2D | Foreground leaves, dust, light rays, edge blur, cursor glow, scroll progress rail |

Total: 2D 40, 2.5D 40, 3D 20.

### 4.3 Quality tiers and fallbacks (mandatory)
The scene must pick a tier automatically and let the visitor change it ("Reduce effects" toggle in the footer and in an accessible control near the top).

| Tier | Layers | 3D | When used |
|---|---|---|---|
| **lite** | about 30 | None. Static images only | Low memory or few CPU cores, `saveData` on, slow connection, `prefers-reduced-motion`, an FPS probe below about 40 in the first second, or **any unknown device** |
| **standard** | up to about 70 | 1 or 2 simple objects | Mid devices that pass the probe |
| **full** | all 100 | All | Fast desktops and phones that pass the probe |

- Detect with feature checks (`navigator.hardwareConcurrency`, `navigator.deviceMemory` where it exists, `navigator.connection` where it exists, `matchMedia`, WebGL support) plus a short FPS probe. Don't rely on any single API.
- **Default to lite** until a probe passes. Never block content on the scene.
- Add a `?layers=lite|standard|full` query parameter and a dev-only FPS and layer-count overlay.

### 4.4 Rendering rules
- **One** WebGL canvas for the whole page, fixed behind the content, with **at most about 12 draw calls** in the full tier. Low-poly models, compressed glTF (Draco or meshopt, KTX2 textures), no real-time shadows below full, capped device pixel ratio (2 at most), `frameloop` on demand.
- Pause rendering when the canvas is off-screen or the tab is hidden. Dispose geometries, textures and materials on unmount.
- One scroll source: a single `requestAnimationFrame` loop reads scroll position and writes transforms. **Transform and opacity only.** Activate layers with `IntersectionObserver` so off-screen layers cost nothing. Use `will-change` sparingly.
- Parallax and 3D use native scrolling. **No scroll-jacking**: the visitor can always scroll normally, use keyboard, use anchor links and use browser find. Smooth-scroll libraries stay off on touch devices.
- Animation library: GSAP with ScrollTrigger, or Framer Motion, or a small custom engine. Pick one and keep it lazy-loaded. Check the licence.
- The scene is decoration: wrap it in `aria-hidden`, and keep all real content as normal semantic HTML on top (headings, text, buttons, links). Nothing important lives only in the canvas.

### 4.5 Chapters (the page stays short even though the scene is deep)
Keep to **at most 7 chapters**. Each chapter is one screen or two of scroll.

1. **Hero:** headline, one line, two buttons (**Open your store, free** and **See an example store**), the street scene settling into place. Suggested headline: "Your business deserves more than a WhatsApp catalogue." Sub: "Create an online store, take orders and deliveries, and let customers near you in Ilorin find you."
2. **How it works:** three steps (create your store, share one link, get orders), with the phone model showing each step.
3. **Sell, Manage, Deliver:** three cards tied to scene objects (storefront, order board, scooter).
4. **Find stores near you:** a small live map of **example** stores, clearly labelled as examples until real stores exist, linking to the map page.
5. **Plans:** the hoverable plan cards (4.6).
6. **Seller stories:** real stories only; **hide the chapter when there are none**.
7. **FAQ and final call to action.**

Copy rules from T02 stay: no fake counters, no fake testimonials, no claims the code can't back up. Run the claims audit again after the redesign.

### 4.6 Hoverable plans
Three cards from the plan config (T11): **Starter**, **Business Plus**, **Business Pro**.

- **Hover and keyboard focus (same behaviour):** the card lifts with a gentle 3D tilt (6 degrees at most) that follows the pointer, a soft light glow follows the cursor, the feature list expands with icon animations, and the other cards dim slightly.
- **Touch devices (no hover):** tap to expand a card. No tilt.
- **Reduced motion:** no tilt or glow movement. Expansion still works.
- Each feature line has a **real icon** and a short tooltip explaining it. A collapsible "Compare plans" table sits underneath.
- Content is **read from the plan config**, never hard-coded. Starter shows **Open your store, free**. While billing is off, paid plans show **Coming soon** with a **Join waitlist** button; do not show a working "Buy" button. Prices shown are test prices and must be labelled as introductory or "planned".
- Cards use the shared `Button` and `Chip` components.

### 4.7 Budgets and checks
- **LCP element is real HTML or an image, not the canvas.** Show a static poster of the hero immediately.
- Largest Contentful Paint 2.5 seconds or better on a mid-range Android phone on 4G; Cumulative Layout Shift 0.05 or less; Interaction to Next Paint 200 ms or less.
- JavaScript for the page without the scene: 180 KB gzipped or less. Scene code and assets load **after first paint and idle**, and the whole scene stays under about 600 KB on the lite tier and about 2.5 MB on the full tier over the network.
- Lighthouse mobile performance: 85 or more on the lite tier, and no regressions in accessibility, best practices or SEO.
- Test by throttling the CPU 4x and the network to slow 4G, and on a real mid-range Android phone. Report real measurements in the task report.
- SEO: the content is in static HTML; add titles, descriptions, canonical URLs, social share images, and structured data for the organisation. Keep the copy honest.

---

## 5. Redesign each section (T01 to T14)

For each task: do the functional work in `BUILD.md`, **and** redesign it as below, using only the shared components. Show before and after screenshots in the task report.

**T01 Brand and identity**
- Original wordmark and logo mark, favicon, app icon (maskable), social share image, a brand page in `docs/DESIGN.md`. Everything reads from `BRAND`. Colour, type and icon style follow the tokens.

**T02 Landing page**
- Section 4 above. Also redesign `/about`, `/pricing` (same plan cards), `/faq`, and the legal pages with the same layout system.

**T03 Feature flags**
- Owner-only flag panel in the admin area (list, description, on or off, last changed by). Hidden features show a tidy "Coming soon" state instead of a dead link.
- Storefront templates: design **3 to 5 polished templates** (each light and dark aware) with a live preview in the template picker; logo and accent colour customisation only.

**T04 Orders and payments (manual only)**
- Order detail page: a visual **status stepper** with icons for both the order track and the payment track, buyer and delivery info cards, line items, payment method panel, proof-of-transfer upload with preview, and an activity timeline. One-tap status buttons sized for thumbs.
- Clear labels: "Awaiting your confirmation", "Paid (confirmed by seller)". Never imply online payment.

**T05 Cart and checkout**
- Cart drawer (mobile bottom sheet, desktop side drawer) with quantity steppers, notes, stock warnings and a delivery-fee line that updates when the area is chosen. Sticky **View cart** bar with a count badge.
- Checkout as a short stepper (contact, delivery or pickup with area chips and optional map pin, payment method, review). Order confirmation with a tidy summary, status timeline, share-tracking-link button and the WhatsApp handoff button. Subtle success animation, no emoji.

**T06 Seller onboarding**
- A guided wizard with a progress ring and a persistent checklist card on the dashboard. Camera-first bulk product add (take photo, name, price, next). Preview of the live store beside the form on desktop. Celebrate completion with a share-your-link screen with QR download.

**T07 Map**
- Section 6 below.

**T08 Delivery zones and fees**
- Zone editor: Ilorin area chips to select, a fee and minimum-order table with inline editing, a preview of what the buyer will see, and a mini map highlighting the selected areas.

**T09 Delivery tracking, dispatch and riders**
- **Public tracking page** (`/track/<token>`): a big status header, a vertical timeline with icons and timestamps, a rider card (first name, call and WhatsApp buttons), a small map with the store and drop-off pins, the OTP shown clearly to the buyer, and a plain-language failure and reschedule state.
- **Dispatch board:** columns by delivery status as cards (works as a horizontally swipeable board on mobile), one-tap status buttons, rider assignment through a bottom sheet, filters as chips.
- **Riders list:** cards with active toggle, call and WhatsApp buttons.

**T10 Admin dashboard**
- KPI tiles with trend arrows and sparklines, charts with accessible colour pairs and data-table alternatives, a store list with filters, the cohort retention grid, and per-area breakdown. Owner-only. Loads fast with skeletons.

**T11 Plans and gating**
- In-app plans page using the same hoverable cards. **Locked feature states** (an icon, one sentence, "Coming soon" or "Join waitlist" button) wherever a feature is gated.

**T12 CRM and seller analytics**
- Customer list with search, repeat badges, and a side drawer with order history, notes and one-tap WhatsApp. Seller analytics cards (sales this week, top products, low stock, returning customers, cart-to-order conversion) with designed empty states for new stores.

**T13 Trust basics**
- **Blue tick badge component** with a tooltip showing the public rule. Review cards and a review form that is only reachable from a real order. A report flow (reason chips, optional note) and a moderation queue with keyboard shortcuts. Clear refund, cancellation and dispute text in a friendly layout.

**T14 Quality and scale hardening**
- Run the quality gates in 3.3, fix findings, and complete `docs/HARDENING.md`. Add the 100-layer performance report to it.

**Also redesign:** store page and product page (using the template system), buyer account, seller settings, authentication screens, notifications centre, 404 and error pages, and every empty state.

---

## 6. Map page redesign: Snap Map-style layout (R4, extends T07)

The map page is a full-screen experience. **Take the layout feeling of Snap Map, not its assets or branding.** Stores only, Ilorin only, no live people.

### 6.1 Mobile layout (default)
- **Full-bleed map.** The map is the page.
- **Top:** a floating **search pill** (search area, landmark or store) with a menu or avatar button; under it a horizontally scrolling row of **category chips** (same `Chip` component) plus **Open now**, **Trending** and **Heat** toggles.
- **Right edge:** a vertical stack of floating buttons: **Locate me**, **Map layers** (heat, 3D buildings), **Reset to Ilorin**.
- **Bottom sheet** with three snap points that you drag with momentum: **peek** (a row of nearby-store cards you can swipe), **half** (card list plus area chips), **full** (full list with sort and filters). Sheet position and the selected store sync to the URL.
- **Pins:** round logo pins with a category-coloured ring; an **open now** pulse; a bright story ring when the store has a fresh status; clusters as count bubbles. The selected pin grows with a spring animation and the map flies to it. Labels appear from a zoom level that avoids clutter.
- **Tap a pin:** the sheet jumps to that store's card (photo, name, rating, open status, distance when allowed, and **Order**, **WhatsApp** and **Directions** buttons). Swipe the card up for the full store page preview.
- **Heat layer:** a soft glow over areas of activity using aggregated and anonymised counts (last 24 hours, minimum 5 events before an area shows). Off by default for first-time visitors; the toggle remembers the choice.
- **Story viewer:** tap a story ring for a full-screen, tap-to-advance viewer with segment progress bars, swipe down to close, report button, and a link to the store. Stores post one short status that expires after 24 hours. Behind a flag until moderation (T13) is ready.
- **Trending in Ilorin** strip: appears only once there are enough real stores; hidden otherwise.
- **Area quick-jump:** a chips row of Ilorin areas (Tanke, Fate, Taiwo Road, Ipata and the rest of the seeded list) that flies the map to that area.

### 6.2 Desktop layout
- A left panel (about 400px) with search, chips and the store list; the map fills the rest. The bottom sheet becomes the left panel. Selecting a store opens a detail panel that slides over the list. Keyboard shortcuts: `/` focuses search, arrows move through results, `Esc` closes details.

### 6.3 Visual style
- A custom **soft map style** (pastel land and water, rounded bold area names, clear main roads) with a **light and a dark variant**. Optional **3D buildings** layer, off by default and only offered on capable devices.
- The base map is OpenStreetMap data from the self-hosted Ilorin file (T07). The Snap look comes from the style and the layers, not from changing provider.
- All map controls use the shared `IconButton` and `FAB`. No emoji pins; pins use the icon set and store logos.

### 6.4 States and edge cases
- Loading skeleton for the sheet and a blurred map placeholder. Empty state ("No stores here yet", with a **Join the waitlist** or **Invite a seller** button). Offline and map-failed state falls back to the list view grouped by area. "Outside Ilorin" state if location is elsewhere: stay on Ilorin and use the area chips.
- **Privacy (non-negotiable):** the buyer's position never leaves the browser; no friend maps, no "who is nearby", no individual order points on any public layer.
- **Performance:** lazy-load the map, sheet and story viewer; cluster at scale; test with 500 stores to prove the pin layer stays smooth.
- Track events: `map_opened`, `pin_tapped`, `story_viewed`, `heat_toggled`, `store_directions_clicked`, `store_order_clicked`.

---

## 7. Do not do

- No emojis in the UI. No raw buttons. No second icon set.
- No copying Snapchat's, Bolt's or any other product's artwork, avatars, pins, logos or screens.
- No scroll-jacking. No content that exists only in a canvas. No effect that can't turn itself off.
- No payment processing. No live people locations. No fake numbers or testimonials.
- No stores or map outside Ilorin.
- No new dependency without a licence and bundle-size check.

---

## 8. Stop and ask the owner when

- You want to change anything in the colour scheme (section 2.6), or need the owner's choice of logo direction or icon set.
- You want to commission or buy 3D models or illustrations, or use any asset with unclear licensing.
- A fancy effect would break the performance budget and you want to relax a budget.
- A paid service is needed (hosted tiles, error tracking beyond free tiers, CDN, image service).
- You find a conflict between this file and `BUILD.md` that this file doesn't settle.

---

## 9. Order of work

| Step | Task | Done when |
|---|---|---|
| R0 | Repo audit (T00), plus design audit: list every emoji, every button style and every category control in the app | `docs/AUDIT.md` and `docs/DESIGN_AUDIT.md` written |
| R1 | Design foundation: tokens and the colour scheme (2.6), themes, fonts, icon set, `Button`, `Chip` and the component library, lint rules (no emoji, no raw buttons), playground | Every existing screen uses shared components, zero emojis, CI check passes |
| R2 | Architecture scaffolding: structure, data layer, error boundaries, PWA shell, test and CI setup | `docs/ARCHITECTURE.md` done, CI gates running |
| R3 | T01 brand and rename, then T02 landing scene (manifest, tiers, 100 layers, hoverable plans) | Budgets in 4.7 met and measured |
| R4 | T07 map base (Ilorin lock, tiles, style), then the Snap-style page and layout in section 6 | Works on a mid-range phone on mobile data |
| R5 | T03, T04, T05, T06 (flags, orders and payments, cart, onboarding) redesigned | Guest can order 3 items end to end |
| R6 | T08, T09 (zones, tracking, dispatch, riders) redesigned | Placed to delivered with a timeline and proof |
| R7 | T10, T11, T12, T13 (admin, plans, CRM, trust) redesigned | Each has loaded, empty, error and offline states |
| R8 | T14 hardening: tests, accessibility, performance, docs | `docs/HARDENING.md` complete, all CI gates green |

---

## 10. Final check

- Zero emojis in the UI; one icon set; the CI check passes.
- One `Button` and one `Chip` used everywhere; no ad-hoc buttons.
- `/` renders a 100-layer scene (2D, 2.5D and 3D) with the three quality tiers, automatic fallbacks, a "Reduce effects" control, and measured performance within budget.
- Plans are hoverable (tilt and glow on hover and focus, tap on touch), read from config, and show "Coming soon" while billing is off.
- The map page matches section 6, is Ilorin-only, and shows stores only.
- Every T01 to T14 screen is redesigned with loaded, empty, error and offline states.
- Honesty, privacy, payments-deferred and Ilorin-only rules from `BUILD.md` still hold.

## 11. Questions for the owner (ask before R3)

- Do you approve the colour scheme in section 2.6 (emerald brand, sun-amber accent, dark-first with a light theme), or do you want changes? Any logo ideas you already have?
- Lucide, Phosphor or Tabler for icons?
- 3D models: should the AI build simple low-poly models in code, or will you commission or supply them?
- Is it fine for the landing page to start in the **lite** tier on unknown devices?
- Should paid plans show "Coming soon" with a waitlist, or hide until billing is ready?
- Should stores' daily status (story) launch with the map, or after moderation is built?
