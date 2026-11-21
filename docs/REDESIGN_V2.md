# REDESIGN_V2.md: Full redesign of every page, from "/" to "/home", the map and the dashboard

App: **Kwaravend**. Launch region: **Ilorin, Kwara State only**.
Colour scheme: **blue, gold, white, black and green** (section 2).
Depth: **2D, 2.5D and 3D** on "/" and "/home", and light 2.5D touches in the app (section 3).
Required libraries: **shadcn/ui** for components and **Motion** (motion.dev) for animation (section 0.1).
Hero reference: the owner's screenshot of the current landing page, rebuilt in the new palette (section 5.1).

---

## 0. How this file relates to the others

Read `BUILD.md` and `KWARAVEND_IMPROVEMENTS.md` first, then `REDESIGN.md`, then this file.

**This file replaces `REDESIGN.md` on:**
- the colour scheme (`REDESIGN.md` section 2.6, the emerald and amber scheme, is **retired**),
- the visual design and layout of every page,
- the "/" scene art direction (the 100-layer structure stays),
- the map page look and layout,
- the seller dashboard design,
- the new "/home" page.

**`REDESIGN.md` still applies, unchanged, on:** design tokens as CSS variables (2.1), typography (2.2), icons with no emojis (2.3), the one `Button` and one `Chip` system (2.4), layout and motion basics (2.5), architecture and system design (section 3), quality gates (3.3), the layer manifest and quality tiers (4.2 to 4.4), budgets (4.7), "do not do" (section 7).

**`BUILD.md` and `KWARAVEND_IMPROVEMENTS.md` still win on:** honesty (no fake stats, stores, reviews or testimonials; the demo stays labelled "Example store / Sample data"), payments deferred (manual methods only), Ilorin-only map and stores, privacy (buyer location stays in the browser; no live people locations), hide features with flags instead of deleting, server-side prices and totals, and the rule to stop and ask the owner for keys, paid services and legal decisions.

If anything conflicts, the order of authority is: `BUILD.md` rules on honesty, payments, privacy and Ilorin; then this file; then `REDESIGN.md`.

### Route names
The owner calls the pages "/" and "/home". Treat them like this, then confirm in the audit (R0):
- `/` is the **public landing page** (visitors who are not signed in, or anyone who opens the root).
- `/home` is the **buyer home**: the first screen of the app for a buyer, signed in or as a guest, once they enter the app. It is where they find stores and order.
- `/dashboard` is the **seller dashboard** (use the real route name if different).
- If the repo already uses these names differently, keep the repo's routes, say so in `docs/AUDIT.md`, and apply the matching design.

---

## 0.1 Required libraries: shadcn/ui and Motion

The owner requires **shadcn/ui** for components and **Motion** (motion.dev) for animation. Both need React. shadcn/ui also needs Tailwind CSS. The T00 audit decides if the repo can use them; if it is not React and Tailwind, **stop and ask the owner** before choosing a replacement. Check both licences in the audit (they are normally permissive) and record bundle sizes.

### shadcn/ui
- **Setup:** run `npx shadcn@latest init` (or the `pnpm dlx` form). It installs dependencies, adds the `cn` helper, writes `components.json` and configures CSS variables. Add components with `npx shadcn@latest add <name>` (several names at once are allowed; `--dry-run` previews; `--path` sets the folder). The components are written into the repo, so they are ours to edit.
- **Where they live:** `shared/ui`. Pages and features import only from there. Do not add a second UI library (no MUI, Chakra, Ant or similar).
- **Use these components where they fit** (check each exists in the CLI): `Button`, `Badge`, `Card`, `Input`, `Textarea`, `Select`, `Checkbox`, `Switch`, `Tabs`, `Toggle` and `ToggleGroup`, `Tooltip`, `Popover`, `Dropdown Menu`, `Dialog`, `Sheet` (drawers, cart, mobile menu), `Drawer` (bottom sheets), `Command` (the command palette), `Table`, `Skeleton`, `Sonner` (toasts), `Accordion` (FAQ), `Avatar`, `Progress`, `Separator`, `Carousel` (the "open now" row), `Sidebar` (dashboard rail), `Chart` (dashboard charts).
- **`Button`** is the shadcn `Button`, extended with variants (`default` blue, `secondary` outline, `ghost`, `destructive`, `link`, and `cta` green for the nav "Sell free" button) and sizes (`sm`, `md`, `lg`, `icon`), with a loading state. **`Chip`** is a styled `Toggle` or `ToggleGroup` item. **Status badges** are the `Badge`. The "no raw `<button>`" lint rule stays; shadcn primitives are allowed.
- **Map bottom sheet:** try the `Drawer` with snap points first. If it cannot do three snap points with momentum and URL sync, build the sheet with Motion's `drag` instead.
- **Theming:** shadcn reads CSS variables under `:root` (light) and `.dark` (dark), and exposes them through `@theme inline` as `--color-*`. Keep **our tokens (section 2) as the source** and map them like this:

| shadcn variable | Our token |
|---|---|
| `--background` / `--foreground` | `--bg-0` / `--text` |
| `--card` / `--card-foreground` | `--surface` / `--text` |
| `--popover` / `--popover-foreground` | `--surface-raised` / `--text` |
| `--primary` / `--primary-foreground` | `--primary` / `--on-primary` |
| `--secondary` / `--secondary-foreground` | `--surface-raised` / `--text` |
| `--muted` / `--muted-foreground` | `--bg-1` / `--text-muted` |
| `--destructive` | `--danger` |
| `--border`, `--input` | `--border` |
| `--ring` | `--primary` |
| `--chart-1` to `--chart-5` | blue, gold, green, `#A99BFF`, `#9FB0D0` |
| `--sidebar*` | `--bg-1`, `--text`, `--primary`, `--border` |

- **Gold and green are custom tokens.** Do **not** map gold to shadcn's `accent` (that variable is for hover and subtle backgrounds). Add `--gold`, `--gold-fill`, `--on-gold`, `--green`, `--on-green` under `:root` and `.dark`, expose them in `@theme inline` as `--color-gold`, `--color-green` and so on, and use them as `bg-gold`, `text-green` and so on.
- Keep the raw-hex lint rule: hex values appear only in the tokens file and the map style.
- Keep Radix accessibility behaviour (focus traps, keyboard use, labels) when you restyle components, and run axe on every restyled component.

### Motion (motion.dev)
- **Setup:** `npm install motion`, then `import { motion, AnimatePresence } from "motion/react"`. Motion is tree-shakable; use `LazyMotion` with the `m` components if the bundle audit shows the page is over budget (see Motion's "Reduce bundle size" guide).
- **Reduced motion:** wrap the app in `MotionConfig` set for the user's reduced-motion setting (see Motion's Accessibility guide) and use `useReducedMotion` where code needs it. Tie it to the **Reduce effects** control from section 3.4, so one switch turns off tilt, parallax, glow, loops and 3D.
- **Use Motion for all DOM animation:**
  - Press and hover: `whileTap` (scale 0.97) and `whileHover`.
  - Reveals: `whileInView` with a stagger for chapters and card rows.
  - Shared transitions: `layout` and `layoutId` for the tab underline, chip selection, and a card expanding into its detail.
  - Scroll effects: `useScroll` with `useTransform` for parallax, the gold scroll-progress rail and the header glass. Scrolling stays native.
  - Sheets and carousels: `drag` with springs, `AnimatePresence` for enter and exit.
  - Numbers: a one-time count-up on first view.
- **Not Motion:** the WebGL scene (section 3.4) uses three.js or react-three-fiber. Motion values (like scroll progress) may feed it. Do not use GSAP; Motion is the single animation library.
- **Shared presets** in `shared/lib/motion.ts`: spring and ease presets matching the duration tokens (120, 200, 320, 500 ms), and reusable variants (`fadeUp`, `scaleIn`, `stagger`, `lift`). Pages use the presets, not ad-hoc numbers.
- Animate **transform and opacity only**. No infinite loops except the slow float of the hero phone, which stops under reduced motion and when off-screen.

---

## 1. Design direction

### 1.1 What "vibecoded" means here
The owner wants the app to feel like a bold, modern, hand-made product with personality, not a stock template. Turn that into concrete rules:

1. **Big, confident type.** Large display headings, tight tracking, one expressive display font plus one clean text font. Numbers (prices, counts) in tabular figures, large and bold.
2. **Depth you can feel.** Layered surfaces, soft coloured glows, 2.5D tilt cards, light 3D objects. Things lift, press and settle. Section 3 defines the depth system.
3. **Colour blocks with intent.** Black canvas, blue structure, gold highlights, green for "live and good". No random gradients.
4. **Alive micro-interactions.** Press feedback, springy sheets, count-up numbers, pins that pop, a status stepper that fills. All short, all optional under "Reduce effects".
5. **Local personality in the content, not in clip art.** Ilorin area names, Nigerian copy, naira formatting, WhatsApp as a first-class action. Original illustration only.
6. **Dense where it helps, airy where it sells.** The landing page is spacious and dramatic. The dashboard is calm and information-first.

**Avoid the "generic AI template" look:** centred hero with a purple gradient blob, three identical icon cards, stock emoji bullets, grey placeholder boxes, every card the same size. Mix card sizes, use asymmetry, give each page one memorable focal moment.

### 1.2 UX principles (apply to every page)
- **Thumb zone first.** Primary actions in the bottom third on phones. Bottom navigation, bottom sheets, sticky action bars.
- **One primary action per screen**, one clear next step.
- **Area first.** A visible Ilorin area selector at the top of buyer screens. Most local decisions start with "where".
- **Three taps to order** for a guest: store, items, checkout. No forced sign-up before ordering.
- **WhatsApp is a handoff, not a dead end.** Every order and store has a clear WhatsApp button.
- **Progressive disclosure.** Show the essentials; open details on demand.
- **Forgiving forms.** Inline validation, input masks for phone numbers, remembered details, clear errors in plain language.
- **Plain language.** Write for a Nigerian seller and buyer. Pidgin-ready strings.
- **Every screen has loaded, loading (skeleton), empty, error and offline states.**
- **Test each page** with the squint test (is the focal point obvious when blurred?), the 5-second test (can a stranger say what to do?) and a one-thumb test on a 360px phone.

### 1.3 Inspiration used for this plan
These sources informed the layout and depth decisions. Use the ideas, not the visuals or assets.
- A local shopping discovery case study found that a **3-item bottom navigation**, a **location selector at the top**, **filters as horizontal tags** (not hidden behind a floating button), a **search modal with recent searches and nearby trending areas**, and **swipe actions with small micro-interactions** work well for on-the-go local discovery. It also keeps the floating action button for one top-level action only.
- Dashboard design guidance says: use the **squint test** for hierarchy, show about **3 to 7 KPIs** above the fold, give each KPI **context** (change against a previous period) and a **next action**, use **one hero chart**, pin one date range, never let colour alone carry meaning, and design the **mobile order** as KPIs, then the main chart, then lists. Replace dense tables with summary cards on phones.
- Research on 3D web design says 3D helps **attention and understanding** but hurts on **low-powered devices and slow connections** and when it is **decorative with no purpose**. Defer loading 3D until it is needed, profile on mid-range devices, use **static fallbacks** and respect reduced motion.

Also look at (for feel, not to copy): map-first apps with bottom sheets (ride, food and delivery apps), merchant admin apps with a "Today" home, and command-palette dashboards. Before R3, collect 8 to 10 reference screenshots in `docs/INSPIRATION.md` with one sentence each on what to borrow. Never copy another product's artwork, icons, pins, avatars, logos or exact layouts.

---

## 2. Colour scheme: blue, black, gold, white and green (decided)

### 2.1 Roles (each colour has one job)
| Colour | Job | Approximate share of a screen |
|---|---|---|
| **Black** (very dark navy-black) | The canvas: page and large panels in dark mode | About 60% |
| **Blue** | Brand, primary buttons, links, navigation, selected states, "info" and "in transit" | About 25%, as structure and actions |
| **White** | Text on dark; surfaces and glass highlights on light | Text and light theme |
| **Gold** | The "moment": the one focal highlight per screen, featured items, premium plan, rating stars, story rings, selected pin ring, celebration | About 5%, never more |
| **Green** | "Live and good": open now, delivered, paid and confirmed, money in, positive trend, online dot | Small accents only |

**Gold rule:** at most **one gold focal element per viewport** (apart from rating stars). If everything is gold, nothing is.
**Green rule:** green only ever means open, live, success, confirmed or growth, with **one exception**: the seller call to action **Sell free** in the top navigation is a green button, as on the current site. Never use green as decoration or as the brand colour.
**Blue rule:** all primary buttons in the app are blue, including the hero call to action. Gold on the landing page is the highlighted word in the headline, not a button (section 5.1).

### 2.2 Dark theme (default)
| Token | Value | Use |
|---|---|---|
| `--bg-0` | `#05070D` | Page background |
| `--bg-1` | `#0A1020` | Large panels, map land |
| `--surface` | `#0F1A33` | Cards, sheets |
| `--surface-raised` | `#16264A` | Hovered cards, popovers |
| `--border` | `rgba(255,255,255,0.10)` | Card and input borders |
| `--text` | `#F4F7FF` | Main text |
| `--text-muted` | `#9FB0D0` | Secondary text |
| `--primary` | `#4D94FF` | Blue: buttons, links, selected |
| `--on-primary` | `#04101F` | Text and icons on blue (**dark text, not white**) |
| `--gold` | `#FFC83D` | Gold highlight (text, icons, rings, fills) |
| `--on-gold` | `#1A1100` | Text on gold fills |
| `--green` | `#34E39B` | Open, success, confirmed, growth |
| `--on-green` | `#03140C` | Text on green fills |
| `--danger` | `#FF6B7A` | Errors, destructive actions |
| `--on-danger` | `#1A0306` | Text on danger fills |
| `--warning` | `#FFD166` | Needs attention (always with an icon and label) |
| `--info` | `#4D94FF` | Same as primary |

### 2.3 Light theme
| Token | Value | Use |
|---|---|---|
| `--bg-0` | `#F6F8FD` | Page background |
| `--bg-1` | `#FFFFFF` | Large panels |
| `--surface` | `#FFFFFF` | Cards, sheets |
| `--surface-raised` | `#EAF0FB` | Hovered cards, popovers |
| `--border` | `rgba(10,18,38,0.10)` | Card and input borders |
| `--text` | `#0A1226` | Main text |
| `--text-muted` | `#4B5A78` | Secondary text |
| `--primary` | `#1456E0` | Blue: buttons, links, selected |
| `--on-primary` | `#FFFFFF` | Text on blue |
| `--gold` | `#8A5F00` | Gold **text and icons** (dark enough to read) |
| `--gold-fill` | `#F5B301` | Gold **fills** (badges, rings, highlights) |
| `--on-gold` | `#1A1100` | Text on gold fills |
| `--green` | `#0B7A4B` | Open, success, confirmed, growth |
| `--on-green` | `#FFFFFF` | Text on green fills |
| `--danger` | `#C62839` | Errors, destructive actions |
| `--on-danger` | `#FFFFFF` | Text on danger fills |
| `--warning` | `#8A5F00` | Needs attention |
| `--info` | `#1456E0` | Same as primary |

In dark mode `--gold-fill` equals `--gold`. Always use `--gold` for text and `--gold-fill` for fills.

### 2.4 Verified contrast (WCAG AA needs 4.5 or more for text)
Dark: text on page 18.8; muted on cards 7.9; blue on page 6.7, on cards 5.8, on raised cards 5.0; dark text on blue 6.4; gold on page 13.0; dark text on gold 12.1; green on page 12.1; dark text on green 11.4; danger on cards 6.3.
Light: text on page 17.5; muted on page 6.5; blue on page 5.8; white on blue 6.1; gold text on page 5.3; dark text on gold fill 10.1; green on page 5.1; white on green 5.4; danger on page 5.3.

**Trap:** white text on the dark-theme blue is only 3.0 and **fails**. Use `--on-primary` (dark) there. Add a unit test that checks every token pair listed above and fails the build if a ratio drops below 4.5 (text) or 3.0 (large text and UI borders).

### 2.5 Category colours
Used for the ring on map pins, the icon in `Chip`, and the badge on cards. Each passes 4.5 to 1 on `--surface` and on `--surface-raised`.

| Category | Dark | Light |
|---|---|---|
| Food | `#FF9A55` | `#A94A08` |
| Cakes | `#FF7EB6` | `#BE185D` |
| Beauty | `#C58BFF` | `#7E22CE` |
| Braids and hair | `#A99BFF` | `#5B3FD1` |
| Fashion | `#5CA8FF` | `#1456E0` |
| Accessories | `#3DDDE8` | `#0D6F8A` |
| Phones and gadgets | `#58E08A` | `#137A39` |
| Groceries | `#BDE84F` | `#476F0E` |
| Home services | `#FFC83D` | `#8A5F00` |
| Tutors | `#FF7A85` | `#C62839` |
| Other | `#9FB0D0` | `#4B5A78` |

Never rely on colour alone: every category and status also shows its **icon and a text label**. Category colours are for small marks; they never fill large areas.

### 2.6 Status colours (orders, payments, deliveries)
Always an icon plus a label. Pending: warning. Confirmed: blue. Preparing: gold. Ready: green outline. Out for delivery: blue. Delivered and completed: green. Cancelled and failed: danger. Awaiting payment confirmation: warning. Paid (confirmed by seller): green.

### 2.7 Gradients (decorative only, dark text on top, or no text)
- `--grad-brand`: `linear-gradient(135deg, #4D94FF, #34E39B)`. Hero accents, progress rings, the active tab underline. Dark text passes along the whole ramp.
- `--grad-gold`: `linear-gradient(135deg, #FFE08A, #FFC83D, #E8A300)`. The gold focal button, featured badges, story ring.
- `--grad-skyline`: blue-black to deep blue, used behind the "/" scene.
- **Glows:** a soft blue radial glow (`rgba(77,148,255,0.25)` to transparent) behind hero objects, and a thin gold rim light on 3D objects.
- No gradients on body text or small UI text.

### 2.8 Glass
- Dark: `background: rgba(15,26,51,0.55)`, `border: 1px solid rgba(255,255,255,0.12)`, `backdrop-filter: blur(18px) saturate(140%)`, plus a 1px top highlight.
- Light: `background: rgba(255,255,255,0.72)`, `border: 1px solid rgba(10,18,38,0.08)`, same blur.
- For floating things only: the map search pill, chips row, bottom sheet, floating cards on "/" and "/home", the dashboard top bar when scrolled. Never for long text or forms.
- `backdrop-filter` is expensive. Switch to solid `--surface-raised` in the lite tier, when unsupported, and under "Reduce effects". Check text contrast on the solid fallback and on the worst-case background behind the glass.

### 2.9 Map colours
| Element | Light map | Dark map |
|---|---|---|
| Land | `#EAF0FB` | `#0A1020` |
| Water | `#BBD9F5` | `#0B2447` |
| Parks | `#CDEBD8` | `#0C2A22` |
| Buildings | `#DDE6F5` | `#12203F` |
| Roads | `#FFFFFF` with casing `#C9D6EC` | `#1A2C55` with casing `#0F1A33` |
| Major roads | `#FFFFFF` with casing `#9DB3DD` | `#2B3F73` |
| Labels | `#0A1226` | `#F4F7FF` |

- Store pins: round logo, ring in the category colour. **Selected pin:** gold ring and a glow. **Open now:** a small green dot and a soft green pulse. **Story ring:** `--grad-gold`. **You are here:** a blue dot with an accuracy halo.
- **Heat layer:** transparent, then blue at about 30% opacity, then gold, then a pale gold-white at the hottest cells. Tooltips show the activity level in words, so colour is not the only signal.

### 2.10 Rules
- Implement as CSS variables from one tokens file. Components use tokens only. A lint rule fails on raw hex colours outside the tokens file and the map style.
- Theme follows the system setting with a manual toggle, remembered (in try/catch storage), with no flash of the wrong theme on load. Dark is the default look for screenshots and the landing page.
- The 3D scene lights and materials use the same palette (blue ambient, gold rim and bulbs, green only on "open" signs and status lights).
- Print and email: use the light tokens.

---

## 3. The depth system: 2D, 2.5D and 3D

### 3.1 Definitions
- **2D:** flat SVG, gradient, texture or text. No depth.
- **2.5D:** flat elements placed at different depths: parallax layers, tilt cards, isometric SVG blocks, CSS 3D transforms, layered shadows. It looks dimensional but there is no 3D model.
- **3D:** a real model rendered in WebGL (three.js, optionally react-three-fiber).

### 3.2 Where depth is used
| Screen | 2D | 2.5D | 3D |
|---|---|---|---|
| `/` landing | Yes | Yes, heavy | Yes: 20 layers (hero objects) |
| `/home` buyer home | Yes | Yes: tilt cards, parallax header | Yes: a small city diorama in the header, standard tier and up |
| Map | Yes | Yes: tilted camera | Optional 3D buildings layer |
| Plans (landing and in-app) | Yes | Yes: hover tilt | No |
| Seller dashboard | Yes | Light only: layered shadows, small hover lift | **No WebGL** (battery and focus) |
| Onboarding success and empty states | Yes | Yes | Optional small 3D object, lazy |
| Store, product, cart, checkout, order, tracking | Yes | Subtle only | No |

### 3.3 Shared depth components (build once in R1)
- **`DepthStage`**: a container with a perspective, a fixed set of depth levels (`z0` to `z5`), and a shared pointer or scroll source. Everything else plugs into it.
- **`TiltCard`**: pointer-follow tilt up to 6 degrees, a soft light glow that follows the cursor, a layered shadow that moves opposite to the tilt. Keyboard focus triggers the same lift. On touch: no pointer tilt; use a tiny scroll-linked tilt or none. Reduced motion: no tilt.
- **`ParallaxStack`**: layers that move at different speeds from one scroll source (one `requestAnimationFrame`, transform and opacity only).
- **`IsoBlock` and `IsoScene`**: isometric SVG or CSS-3D blocks for buildings, stalls and parcels. Used for the 2.5D layers and empty states.
- **`Model3D`**: a lazy, single-canvas 3D renderer wrapper with the tiers from section 3.4, a static poster fallback and automatic disposal.
- **`Elevation` tokens**: five layered shadow levels (`e1` to `e5`) tuned for dark (a faint blue-black glow plus a hairline highlight) and light (soft blue-grey shadows).

### 3.4 Tiers, fallbacks and budgets (mandatory, from `REDESIGN.md` 4.3 and 4.4)
- Three tiers: **lite** (about 30 layers on "/", no WebGL, static posters), **standard** (up to about 70 layers, 1 or 2 simple 3D objects), **full** (all 100 layers). **Default to lite on any unknown device** until a short FPS probe passes. A **"Reduce effects"** control sits in the footer and near the top, and `?layers=lite|standard|full` plus a dev-only FPS overlay exist.
- **One** WebGL canvas for the whole page, at most about 12 draw calls in the full tier, compressed glTF (Draco or meshopt) and KTX2 textures, capped pixel ratio (2), render on demand, pause when off-screen or the tab is hidden, dispose everything on unmount.
- Scroll is always native. No scroll-jacking. All real content is semantic HTML on top of the scene; the scene is `aria-hidden` decoration.
- The LCP element is real HTML or an image, never the canvas. Show a static poster immediately.
- Budgets: LCP 2.5 s or better on a mid-range Android phone on 4G; CLS 0.05 or less; INP 200 ms or less; JavaScript without the scene 180 KB gzipped or less; scene about 600 KB on lite and about 2.5 MB on full; Lighthouse mobile performance 85 or more on lite. `/home` has its own budget: LCP 2.5 s, diorama chunk 150 KB gzipped or less, loaded after first paint.
- Measure by throttling CPU 4x and the network to slow 4G, and on a real mid-range Android phone. Report real numbers.

---

## 4. App shell and navigation (all pages)

### 4.1 Buyer shell
- **Top bar:** Kwaravend mark, an **area selector chip** ("Ilorin, Tanke" with a pin icon; opens a sheet with the seeded area list and "Use my location" where allowed), search, notifications.
- **Bottom navigation (4 items):** **Home**, **Map**, **Orders**, **You**. A small cart badge appears on a sticky "View cart" bar above the nav when the cart has items. Active tab: blue icon, label and a short gradient underline.
- **Search modal:** opens full-screen with recent searches, popular categories and trending Ilorin areas (only real data; hide the trending part when there is not enough).
- **Filters** are always horizontal `Chip` rows under the search, never hidden behind a floating button. The floating action button is used for one top-level action only.

### 4.2 Seller shell
- **Phones:** bottom navigation with **Today**, **Orders**, **Products**, **Customers**, **More**. One floating button, **Add product**, on Today and Products only.
- **Desktop:** left rail (collapsible) with the same destinations plus Delivery, Analytics, Settings, Plans. Top bar with search and a **command palette** (`Ctrl+K` or `Cmd+K`) for jumping to orders, customers and actions.
- Open or closed **store toggle** in the header (green when open).

### 4.3 Admin shell (owner only)
Same rail layout as the seller desktop, with an "Admin" label, a flag panel and platform analytics.

### 4.4 Page inventory
Map these to the real routes in R0. Every row gets a redesign, a skeleton, empty, error and offline state.

| Area | Pages |
|---|---|
| Public | `/` landing, `/about`, `/pricing`, `/faq`, legal pages, 404 and error pages |
| Auth | sign in, sign up, reset, verify |
| Buyer | `/home`, search and discover, **map**, store page, product page, cart, checkout, order confirmation, order detail, tracking (`/track/<token>`), saved stores, account and addresses, notifications |
| Seller | onboarding, **dashboard (Today)**, orders list and detail, products list and editor, customers (CRM), delivery zones, dispatch board, riders, analytics, store settings and templates, plans, notifications |
| Admin | overview, stores, flags, moderation queue, analytics |

---

## 5. Public pages

### 5.1 "/" landing: one scene, 100 layers
Keep the structure in `REDESIGN.md` section 4 (the manifest `scene/layers.ts`, 100 layers split 40 2D, 40 2.5D, 20 3D, the tiers, the budgets, the chapters). Change the **art direction** to the new palette.

**Art direction: "Ilorin at blue hour".** The scene opens at dusk and settles into night as you scroll.
- **Sky (A, 2D):** deep blue to black gradient, soft blue haze, a gold sun or moon glow, grain and vignette. The light theme uses a bright blue morning sky with a gold sun.
- **Far city (B, 2.5D):** navy silhouettes of low-rise rooftops, trees, hills and power lines in three parallax depths. Tiny gold window lights switch on as you scroll. No real landmarks unless the owner approves.
- **Mid street (C):** market stalls with gold bulbs, shop fronts, signs, bikes, a bus, people silhouettes, awnings. **Green "OPEN" signs** glow on stalls. 8 layers 2D, 12 2.5D, 4 3D.
- **Hero objects (D, 3D, 16 layers):** a phone showing a store page, a stall, a delivery scooter and rider, floating map pins (blue body, gold ring), a cart, parcels, an order tag. Blue ambient light, gold rim light.
- **Interface layers (E, 16 layers):** floating glass cards ("New order", status chips, rating stars, a delivered tick in green), connector lines, step markers.
- **Foreground (F, 2D, 12 layers):** leaves, dust, light rays, edge blur, cursor glow, a gold scroll-progress rail.
- Floating cards show **example content, clearly labelled**; no real numbers unless real.

**Hero reference look (from the owner's screenshot of the current landing page).** The owner likes this layout. Rebuild it with shadcn/ui and Motion in the new palette. It overrides the simple hero wireframe below. Do not copy anything that breaks the honesty rules.

- **Top bar (about 80px, dark, hairline bottom border):** on the left the logo tile and the wordmark, with "Kwara" in white and "vend" in gold. Next to it a wide **search pill** (search icon, placeholder "Search products, services or stores...", and a blue **Search** button inside the pill). Then the links **Discover** and **About** (Rankings stays hidden behind its flag), an outlined **Account** button with a user icon, and the green **Sell free** button (`cta` variant) with a store icon. On phones the links go into a `Sheet` menu, and the search pill becomes an icon that opens the search modal.
- **Background:** near-black (`--bg-0`) with a faint square grid (1px lines at about 4% white, cells of about 64px) that fades out with a radial mask, plus a soft blue glow low on the right behind the mockup. In lite tier the grid is a static CSS background.
- **Left column:**
  - A small pill badge with a gold star icon and "Kwaravend, built in Ilorin".
  - The **display headline**, four lines, very heavy weight, tight tracking, white, with the last word in gold. Use a heavy open-licence grotesk (for example Inter Tight or Geist), weight 700 to 800, tracking about -0.03em, self-hosted. Prices and numbers use a monospace (Geist Mono or JetBrains Mono).
  - A muted sub-line.
  - Two buttons side by side: the blue **Open your store, free** with a right-arrow icon, and the outlined **Explore stores near you**.
  - A small text link "Read the Kwaravend story" with an arrow icon.
  - A row of three outlined **check pills**, each with a check icon. Only use claims verified by the claims audit: "No card to start", "No commission", "Pickup or delivery". Do not add "POS and staff included" until the owner confirms that promise (see `KWARAVEND_IMPROVEMENTS.md`).
- **Right column, the product mockup (2.5D):**
  - A **browser frame** (three window dots, a URL pill such as `kwaravend.ng/s/example-store`) in a dark card with a thin border and a soft blue shadow.
  - A **gold pill on its top-left edge** that says **EXAMPLE STOREFRONT**. This label is required by the honesty rules; the mockup content is sample data and must say so.
  - Inside: a store header (avatar, store name, a blue verified tick used on the example only, area, a green **Open now** pill), a blue promo banner with a headline and one line, and three product cards (image placeholder, name, price in ₦ in the monospace font).
  - A **tilted phone** overlapping the bottom right of the frame (rotated about 8 degrees), showing a chat with a store, two message bubbles and a green **Order on WhatsApp** button. **No emojis** in the bubbles (the old site has some; remove them).
  - The mockup follows the pointer with `TiltCard` (up to 6 degrees). The phone floats slowly (4 to 6px, a long loop). On touch devices: no pointer tilt, only the float. Reduced motion: no tilt and no float.
- **Motion on load (Motion):** the badge, headline lines, sub-line, buttons and check pills rise and fade in with a short stagger; the gold word gets a one-time highlight sweep; the browser frame slides in with a spring and the phone follows. Under 1.2 seconds in total, never blocking input.
- **Layers:** the grid and glow are the first background layers (band A). The browser frame and phone are layers in bands D and E (the phone is a 3D object on standard and full tiers, a static image on lite). The 100-layer street scene starts below the hero and in the far background, so the hero stays as clean and readable as the reference.
- **Mobile (390px):** one column. Badge, headline (about 3 lines), sub-line, the two buttons stacked full width, then the mockup below (smaller, phone overlapping), then the check pills wrapped onto two lines.

**Layout of the chapters (at most 7).** Use asymmetry, not a row of identical cards.

```
Mobile (390px)                          Desktop (1280px)
+--------------------------+            +----------------------------------------------+
| [mark]            [menu] |            | [mark]   How it works  Plans  FAQ  [Sell free]|
|                          |            |                                              |
|  Big headline (3 lines)  |            |  Big headline         [ 3D phone + stall ]   |
|  one sentence            |            |  one sentence         [  scooter, pins   ]   |
|  [Open your store, free] |            |  [Open your store, free] [See an example]    |
|  [See an example store]  |            |                                              |
|  ~~~ scene settles ~~~   |            |  ~~~~~~~~~~~~ scene (parallax) ~~~~~~~~~~~~  |
+--------------------------+            +----------------------------------------------+
```

1. **Hero.** Built to the reference look in "Hero reference look" below. Headline: "Your storefront deserves more than a WhatsApp catalogue." with the word more in gold (superseded by docs/KWARAVEND_REBRAND_CHANGES.md R1). Sub: "Create an online store, take orders and deliveries, and let customers near you in Ilorin find you." Buttons: **Open your store, free** (blue, with an arrow icon) and **Explore stores near you** (outlined). The street scene unfolds behind and below the hero as the visitor scrolls.
2. **How it works.** A sticky phone model (3D on standard and full, a 2.5D image on lite) that changes screen across three steps: create your store, share one link, get orders. Steps scroll on the left, the phone stays.
3. **Sell, Manage, Deliver.** Three **different-sized** tiles (one large, two small) tied to scene objects: the storefront, the order board, the scooter. Hover or focus tilts each.
4. **Find stores near you.** A tilted 2.5D mini-map card of **example** stores (labelled "Example stores") with a button to the real map. If real stores exist, show real ones.
5. **Plans.** The hoverable plan cards (section 5.2).
6. **Seller stories.** Only real stories. **Hide this chapter when there are none.**
7. **FAQ and final call to action.** A short accordion and one last button.

Copy rules: no fake counters, testimonials or claims. Re-run the claims audit after the redesign.

### 5.2 Hoverable plans (on "/", "/pricing" and in-app)
Three cards from the plan config: **Starter**, **Emirates Plus**, **Business Pro**. Emirates Plus is the gold-highlighted "featured" card (gold ring and glow), which is the one gold focal element in that viewport.

- **Hover and keyboard focus (same behaviour):** the card lifts and tilts up to 6 degrees following the pointer, a soft blue light follows the cursor, the feature list expands with icon animations, the other cards dim slightly.
- **Touch:** tap to expand; no tilt. **Reduced motion:** no tilt or glow movement; expansion still works.
- Every feature line has a real icon and a short tooltip. A collapsible **Compare plans** table sits under the cards.
- Content comes from the **plan config**, never hard-coded. Starter shows **Open your store, free**. While billing is off, paid plans show **Coming soon** and **Join waitlist**; never a working Buy button. Prices shown are labelled "planned".

### 5.3 Other public pages
- **`/pricing`:** the plan cards plus the comparison table and a short FAQ.
- **`/about`:** one short story, the mission, and an honest "we are starting in Ilorin" note. A small 2.5D Ilorin skyline illustration.
- **`/faq`:** searchable accordion, grouped by seller and buyer.
- **Legal pages:** clean reading layout, table of contents, last-updated date. Do not write legal text; flag gaps to the owner.
- **404 and error pages:** a small 3D or 2.5D "lost parcel" illustration, a plain sentence and one button back to Home.
- **Auth screens:** a split layout on desktop (form left, depth illustration right), a single column on phones, large inputs, phone-friendly, social sign-in only if already supported.

---

## 6. "/home": the buyer home

### 6.1 Goal
Show buyers what is open and good near them in Ilorin within a second, and get them to a store in one tap. Works for guests and signed-in users. Honest empty states while there are few real stores.

### 6.2 Layout (mobile first)

```
+----------------------------------+
| [mark] [Ilorin, Tanke v] [search][bell] |   top bar (glass)
+----------------------------------+
|  Diorama header (3D or 2.5D)     |   small isometric Ilorin blocks;
|  "Open near you, right now"      |   open stores pop up as pins
|  [search field, large]           |
+----------------------------------+
| (Food)(Cakes)(Beauty)(Fashion)...|   Chip row, horizontal scroll
+----------------------------------+
|  Open now near you          See all |
|  [card][card][card] ->           |   TiltCards, horizontal, snap
+----------------------------------+
|  [ Mini-map card, tilted 2.5D ]  |   "Explore the map" button
+----------------------------------+
|  Order again (signed-in only)    |
|  New on Kwaravend                |   real stores only
|  Areas to browse: Tanke Fate ... |   area Chips
+----------------------------------+
|  [View cart bar, when items]     |
| Home   Map   Orders   You        |   bottom nav
+----------------------------------+
```

### 6.3 Sections in detail
1. **Top bar:** area selector chip, search, notifications. Glass when scrolled.
2. **Diorama header:**
   - **Standard and full tiers:** a small 3D low-poly scene (about 10 to 14 blocks of Ilorin-style low-rise buildings) rendered on the shared canvas. Real **open** stores appear as blue pins with gold rings that pop up in the right **area** (area level only, never exact addresses). Tap or hover a pin to highlight that store's card below. Pointer or scroll moves the camera slightly.
   - **Lite tier:** a static isometric SVG of the same scene with 2.5D parallax on scroll.
   - If there are no real stores yet, show the diorama without pins and the label "Stores near you will appear here".
   - Budget: diorama chunk 150 KB gzipped or less, loaded after first paint, paused off-screen.
3. **Category chips:** the shared `Chip` row (icon and label, selected state, count when known). Selecting a chip filters the sections below without leaving the page.
4. **Open now near you:** a horizontal snap carousel of `StoreCard` (photo, logo, name, category chip, rating only if it has real reviews, "Open now" green dot, area, delivery or pickup tags, a quick **Order** button). Cards tilt on hover or focus. Sort: open first, then nearest area to the selected one.
5. **Mini-map card:** a tilted 2.5D preview of the map with a few pins and a blue **Explore the map** button. Opens `/map` with the same area selected.
6. **Order again** (signed-in only, hidden otherwise): the last 3 stores or orders with a one-tap reorder that rebuilds the cart.
7. **New on Kwaravend:** the newest real stores. **Hide when empty**, replaced by a calm **Invite a seller** card that shares the sell link.
8. **Areas to browse:** area chips (Tanke, Fate, Taiwo Road, Ipata and the rest of the seeded list) leading to filtered lists.
9. **Collections** (later, behind a flag): curated lists such as "Cakes for the weekend" with a gold "Featured" badge. Only the owner can feature a store, and "Featured" is labelled.
10. **Footer links** are short on `/home`; the app shell's bottom navigation is the footer.

### 6.4 States
- **Loading:** skeleton cards and a blurred diorama poster.
- **Empty (no stores in the area):** a friendly 2.5D illustration, "No stores here yet", buttons **Try another area** and **Invite a seller**.
- **Offline:** show the last cached results with an offline banner.
- **Location denied or outside Ilorin:** stay on Ilorin with the area selector. Do not nag.
- **First visit:** a one-time, skippable hint pointing at the area selector.

### 6.5 Interactions and 2.5D touches
- Cards: lift and tilt on hover and focus; press scale 0.97.
- Header: gentle parallax between the diorama and the search field.
- Chips: springy selection, count badge animates.
- Pull to refresh on phones.
- All of it off under "Reduce effects" or reduced motion.

---

## 7. The map page (extends T07 and `REDESIGN.md` section 6)

Stores only, Ilorin only, no live people. The layout keeps the Snap Map-style feeling from `REDESIGN.md` 6.1 to 6.4; this section adds the new look and the 2.5D and 3D options.

### 7.1 Mobile layout

```
+----------------------------------+
| ( search pill: area, store ) [me]|   glass, floating
| (All)(Open now)(Food)(Cakes)...  |   Chip row, floating
|                                  |
|          FULL-BLEED MAP          |   right edge floating buttons:
|      (logo pins, heat, clusters) |   [locate] [layers] [tilt 3D] [reset]
|                                  |
|  ____ bottom sheet (3 snaps) ___ |   peek: swipe cards
| |  Nearby stores  [sort v]      ||   half: card list + area chips
| |  [store card] [store card] ->  ||   full: list with filters
+----------------------------------+
| Home   Map   Orders   You        |   bottom nav (hides on full sheet)
+----------------------------------+
```

- **Search pill (top):** search area, landmark or store. A menu or avatar button on the right.
- **Chips row:** categories plus **Open now**, **Trending** (only when enough real data), **Heat** toggle. Same `Chip` component.
- **Right-edge buttons (`FAB` and `IconButton`):** locate me, layers (heat, 3D buildings), **Tilt** (switches between flat and tilted view), reset to Ilorin.
- **Bottom sheet:** peek, half and full snap points with momentum, synced to the URL. In peek, a swipeable row of store cards. Selecting a pin makes the sheet jump to that store's card (photo, name, rating if real, open status, distance if allowed, **Order**, **WhatsApp**, **Directions**). Swipe up for the full store preview.
- **Area quick-jump:** a chips row inside the sheet that flies the map to an area.
- **Pins:** round store logos with a category-coloured ring; a green dot and soft pulse when open; a gold gradient ring when the store has a fresh status; clusters as count bubbles. The selected pin grows with a spring, gets a gold ring and glow, and the map flies to it.

### 7.2 Desktop layout
A left panel about 400px wide (search, chips, list, area chips); the map fills the rest. Selecting a store slides a detail panel over the list. A small floating legend (open, story, cluster). Shortcuts: `/` focuses search, arrow keys move through results, `Esc` closes details.

### 7.3 2.5D and 3D on the map
- **Tilt view (2.5D):** a toggle that tilts the camera (pitch about 50 degrees) with a smooth animation. Pins stay upright and readable.
- **3D buildings (optional):** extruded buildings from the OpenStreetMap data in the Ilorin file, **off by default** and offered only on capable devices (standard tier and up). Use a building height tag when present and a small default height otherwise, and describe it honestly in the layers menu ("approximate building heights"). If the file has no building data for an area, show flat footprints.
- A subtle blue-to-black fog at the horizon in tilt view, and a soft gold light on the selected pin. Both disabled in lite.
- The map is a lazy chunk. Lite devices get the flat map only.

### 7.4 Heat, stories and trending
- **Heat layer:** aggregated, anonymised counts for the last 24 hours, minimum 5 events before an area shows, off by default, remembered. Tooltip text states the activity level in words.
- **Story viewer (behind a flag until moderation exists):** full-screen, tap to advance, segment progress bars in gold, swipe down to close, report button, link to the store. Stores post one short status that expires after 24 hours.
- **Trending in Ilorin:** appears only with enough real stores.

### 7.5 States, privacy and performance
- Loading skeleton for the sheet, blurred map placeholder, empty state with **Invite a seller**, offline or map-failed state that falls back to the list grouped by area, "Outside Ilorin" handled by staying on Ilorin and showing area chips.
- **Privacy (non-negotiable):** the buyer's position never leaves the browser; no friend maps, no "who is nearby", no individual order points on any public layer.
- Test with 500 stores to prove the pin layer stays smooth; cluster at scale.
- Track events: `map_opened`, `pin_tapped`, `story_viewed`, `heat_toggled`, `tilt_toggled`, `store_directions_clicked`, `store_order_clicked`.

---

## 8. The seller dashboard

### 8.1 Principles
- The dashboard answers three questions in order: **What needs my attention now? How am I doing today? What should I do next?**
- Hierarchy by the **squint test**: the first thing you see is "needs attention" and the key numbers. Show about 4 KPIs above the fold, each with a comparison and a status.
- **One hero chart**, one pinned date range, never colour alone, charts always have a data-table alternative.
- Calm and fast. Light 2.5D only (layered shadows, small hover lift). **No WebGL.**
- **Honesty:** a new store shows real zeros with designed empty states. Never show sample numbers, unless the owner turns on a clearly labelled **Sample data** mode.

### 8.2 Mobile "Today" layout (default)

```
+----------------------------------+
| (logo) Store name   [Open  (o)] [bell] |   header: open/closed toggle
+----------------------------------+
| 3 orders need action        [Review] |   needs-attention strip
+----------------------------------+
| [Orders today][Sales today][Pending][Low stock] -> |  KPI tiles, swipe
+----------------------------------+
|  Sales, last 7 days   (7d | 30d)  |   hero chart (bars) + table view
+----------------------------------+
|  Order queue                     |
|  [#KV-1042  Pending   [Confirm]] |   cards with one primary action
|  [#KV-1041  Preparing [Ready]  ] |
+----------------------------------+
|  Set up your store  (3/5) ring   |   checklist until complete
|  Share your link | QR | Add product |
+----------------------------------+
| Today  Orders  Products  Customers  More |
|                          [+ Add product] |   the one floating button
+----------------------------------+
```

1. **Header:** store logo and name, an **Open / Closed** toggle (green when open; changing it updates the map and store page), notifications.
2. **Needs-attention strip:** the count of orders waiting for the seller, payments waiting for confirmation, and low-stock items. Warning colour with an icon. Hidden when there is nothing to do, replaced by a calm "All caught up" line.
3. **KPI tiles (4):** **Orders today**, **Confirmed sales today (₦)**, **Pending actions**, **Low stock**. Each shows the value, the change against yesterday (an arrow and text, green for up, danger for down, neutral grey for flat), and a tiny sparkline. Tap opens the matching list.
4. **Hero chart:** sales for the last 7 days (a bar chart) with a 7 or 30 day toggle and a **View as table** option. Uses blue bars with the best day in gold. Empty state: "Your first sale will show here" with a **Share your store** button.
5. **Order queue:** cards for orders needing action. Each has the order code (`KV-` prefix), time, items summary, a status badge, and **one thumb-sized primary action** (Confirm, Mark ready, Assign rider). A mini status stepper shows progress. Swipe a card for secondary actions.
6. **Setup checklist:** a progress ring with the remaining steps (logo, 3 products, hours, WhatsApp number, share link). Disappears when complete, followed by a one-time celebration (gold confetti in 2.5D, no emoji).
7. **Quick actions:** Share link, Download QR, Add product.
8. **Delivery now** (only when there are active deliveries): a compact list with a small map showing the store and drop-off areas.
9. **Floating button:** **Add product** on Today and Products only.

### 8.3 Desktop layout (12-column grid)

```
+---------+-------------------------------------------------------------+
| Rail    | Today          [date range v]   [search / Ctrl K]  [bell][me] |
| Today   |-------------------------------------------------------------|
| Orders  | [KPI] [KPI] [KPI] [KPI]                                     |
| Products|-------------------------------------------------------------|
| Customers| Sales chart (8 cols)                   | Needs attention (4)  |
| Delivery |                                        | Setup checklist       |
| Analytics|----------------------------------------|-----------------------|
| Settings | Order queue table (8 cols)             | Activity timeline (4) |
| Plans    |                                        |                       |
+---------+-------------------------------------------------------------+
```

- The left rail collapses to icons. The command palette handles quick navigation.
- **Orders page:** split view. A filterable list on the left (status chips, date range, search) and an order detail on the right, with the status stepper, buyer and delivery cards, line items, payment panel (manual payment proof preview), and activity timeline. Keyboard shortcuts for next order and status changes.
- **Products page:** a grid or table toggle, bulk actions, low-stock filter, fast inline price and stock edit, and a camera-first **Add product** flow.
- **Customers (CRM):** search, repeat badges, a side drawer with order history, notes and one-tap WhatsApp.
- **Delivery:** zone editor with a mini map and an Ilorin area chip selector; dispatch board with status columns (swipeable on phones) and a rider assignment sheet; riders list.
- **Analytics:** sales this week, top products, low stock, returning customers, cart-to-order conversion, orders by source, each with an empty state.
- **Settings and templates:** a live template preview beside the form, logo and accent colour only. Accent colour choices are checked for contrast.

### 8.4 Dashboard visual style
- Dark by default for sellers who prefer it, light option, both from the tokens. Surfaces are `--surface` on `--bg-0`, with `e1` to `e3` elevation. Blue for actions and selected states, gold for the single focal highlight (best day, featured, celebration), green for open, delivered and growth.
- KPI tiles use a thin top accent line in blue. A tile with something needing action gets a warning dot, not a loud colour fill.
- Numbers are large, bold, tabular. Currency always formatted as ₦8,500.
- Skeletons for every card; optimistic updates for status changes with rollback.

### 8.5 Admin dashboard (owner only)
KPI tiles (stores created, published, weekly active, setup completion, stores with an order, GMV, waitlist counts), a retention grid, per-area breakdown, the flag panel, the moderation queue. Same shell and tokens, loads fast with skeletons.

---

## 9. Other pages

- **Store page and product page:** use the template system. The store header has the logo, name, category chip, open status (green), area, delivery and pickup tags, rating only if real, **Order**, **WhatsApp**, **Share**. A sticky **View cart** bar. Product images with a pinch-to-zoom gallery, a clear price in ₦, stock state, notes field, and quantity stepper. Subtle 2.5D lift on product cards.
- **Cart:** a bottom sheet on phones and a side drawer on desktop. Quantity steppers, per-line notes, stock warnings, a delivery-fee line that updates when the area is chosen.
- **Checkout:** a short stepper (contact, delivery or pickup with area chips and an optional map pin, payment method, review). Manual payment methods only. Clear labels: "Awaiting seller confirmation", "Paid (confirmed by seller)". Never imply online payment. The confirmation screen has a status timeline, a share-tracking-link button, the WhatsApp handoff, and a subtle success animation (gold, no emoji).
- **Order detail and tracking (`/track/<token>`):** a large status header, a vertical timeline with icons and timestamps, a rider card (first name, call and WhatsApp), a small map with store and drop-off pins, the OTP shown clearly, and a plain-language failure and reschedule state.
- **Onboarding wizard:** a progress ring, camera-first product add, a live store preview beside the form on desktop, and a share-your-link screen with a QR download at the end (a small 3D or 2.5D celebration, lazy).
- **Account, saved stores, notifications centre:** simple list layouts with the shared components and designed empty states.
- **Trust screens:** blue tick badge component with a tooltip showing the public rule; review form reachable only from a real order; report flow with reason chips and a moderation queue.
- **Plans in-app:** the same hoverable cards, locked-feature states with an icon, one sentence and a **Coming soon** or **Join waitlist** button.

---

## 10. Motion and interaction details
- All of this is built with **Motion** (section 0.1) using the shared presets.
- Durations 120, 200, 320 and 500 ms; standard, emphasised and spring easings. Animate **transform and opacity only**.
- Press: scale 0.97. Selection: a short spring. Sheets: momentum and rubber-banding. Numbers: count up once, never on every re-render. Status stepper: fills with a short sweep. Success: a brief gold burst (no emoji).
- Skeletons shimmer slowly; they stop under reduced motion.
- Every motion has a reduced-motion version (instant or fade only), and the global **Reduce effects** control disables tilt, parallax, glow and 3D.
- Haptic feedback (`navigator.vibrate`) only for success and errors, off by default, behind a setting.

---

## 11. Engineering notes (in addition to `REDESIGN.md` section 3)
- Add the depth components (section 3.3) and the new tokens (section 2) in R1; migrate every page to the new tokens before any page redesign.
- Add a **token contrast test** (section 2.4) and a **raw hex lint rule** (allowed only in the tokens file and the map style).
- Lazy chunks: the 3D scene (`/`), the diorama (`/home`), the map, charts, the story viewer, the confetti. None may load before first paint.
- Components documented in the playground (Storybook or Ladle) with light and dark, all states, and an axe check. Visual regression snapshots at 390px and 1280px for every page in the inventory, in both themes, and in lite and full tiers where they differ.
- Playwright critical paths: create store, add product, guest order, seller confirms, dispatch, buyer tracks, map open and select, `/home` area change.
- Lighthouse CI: budgets from section 3.4; the dashboard budget is LCP 2.5 s and no WebGL.
- Run the claims audit after the redesign.

---

## 12. Order of work

| Step | Task | Done when |
|---|---|---|
| V0 | Audit: routes (confirm "/", "/home", dashboard), every page, every emoji, button and chip, existing colours. Write `docs/AUDIT.md`, `docs/DESIGN_AUDIT.md` and `docs/INSPIRATION.md` (8 to 10 references) | Documents written |
| V1 | `shadcn init` and Motion setup (section 0.1), tokens and the new colour scheme mapped to shadcn variables, themes, fonts, icon set, `Button`, `Chip`, depth components (`DepthStage`, `TiltCard`, `ParallaxStack`, `IsoBlock`, `Model3D`), elevation tokens, contrast test, lint rules, playground | Every existing screen uses the new tokens and shared components; zero emojis; CI passes |
| V2 | App shells: buyer, seller, admin, navigation, area selector, search modal, states (skeleton, empty, error, offline) | Navigation works on phone and desktop |
| V3 | `/` landing: manifest, tiers, 100 layers (40 2D, 40 2.5D, 20 3D), chapters, hoverable plans | Budgets met and measured on a mid-range phone |
| V4 | `/home`: diorama, chips, open-now carousel, mini-map card, empty states | Budget met; works for guest and signed-in |
| V5 | Map: new style, pins, sheet, tilt view, optional 3D buildings, desktop layout | Smooth on a mid-range phone; 500-store test passes |
| V6 | Seller dashboard: Today, orders, products, customers, delivery, analytics, settings | Each has loaded, empty, error and offline states |
| V7 | Buyer flows: store, product, cart, checkout, order, tracking; onboarding | Guest can order 3 items end to end |
| V8 | Admin, plans, trust screens, public pages, error pages | All inventory pages done |
| V9 | Hardening: tests, accessibility, performance, claims audit, `docs/HARDENING.md` | All CI gates green |

After each step: lint, type-check, tests, build, the relevant Playwright test, then report what changed, how to test it (3 to 5 steps), what is not done, and screenshots at 390px and 1280px in dark and light.

---

## 13. Do not do
- No emojis in the UI. No raw buttons. No second icon set.
- No copying another product's artwork, icons, pins, avatars, logos or layouts.
- No scroll-jacking. No content that exists only in a canvas. No effect that cannot turn itself off.
- No WebGL on the dashboard.
- No white text on the dark-theme blue. No gold used as a second brand colour. No green used for decoration.
- No payment processing. No live people locations. No fake numbers, stores, reviews or testimonials.
- No stores or map outside Ilorin.
- No new dependency without a licence and bundle-size check.

## 14. Stop and ask the owner when
- You want to change any colour in section 2, or need a logo direction or icon set choice.
- You want to commission, buy or use 3D models or illustrations with unclear licensing.
- A fancy effect would break a performance budget and you want to relax the budget.
- A paid service is needed (hosted tiles, error tracking beyond free tiers, CDN, image service).
- This file conflicts with `BUILD.md` in a way this file does not settle.

## 15. Final check
- The five-colour scheme is applied through tokens, and the contrast test passes.
- Gold appears as at most one focal element per viewport; green only means open, live, success or growth.
- `/` is a 100-layer scene with 2D, 2.5D and 3D, three tiers, automatic fallbacks and measured performance within budget.
- `/home` works for guests and signed-in users, with a diorama (3D or 2.5D by tier), real data only, and honest empty states.
- The map matches section 7, is Ilorin-only and shows stores only.
- The dashboard matches section 8, with real zeros and designed empty states, no WebGL.
- Every page in the inventory has loaded, loading, empty, error and offline states.
- Honesty, privacy, payments-deferred and Ilorin-only rules from `BUILD.md` still hold.

## 16. Questions for the owner (ask before V3)
- Do you approve the colour scheme in section 2 (black canvas, blue actions, gold highlights, green for live and success, white text)? Any logo ideas?
- Is `/home` the buyer's home screen, and `/dashboard` the seller dashboard, as assumed in section 0?
- Dark mode as the default look on the landing page and app, with a light theme available?
- Is the hero reference (section 5.1: gold last word in the headline, blue main button, green "Sell free" in the nav) the look you want? Headline now locked as "Your storefront deserves more than a WhatsApp catalogue." (KWARAVEND_REBRAND_CHANGES.md R1).
- Are you happy for the AI to add shadcn/ui and Motion to the repo (both need React and Tailwind)?
- 3D models: should the AI build simple low-poly models in code, or will you supply or commission them?
- Is it fine for pages to start in the **lite** tier on unknown devices?
- Should paid plans show "Coming soon" with a waitlist while billing is off?
- Should store statuses (stories) launch with the map or after moderation is built?

---

## Sources used for the inspiration notes
- [Designing a local shopping discovery app: a UX case study](https://uxdesign.cc/designing-a-local-shopping-discovery-app-a-ux-case-study-d1e99f717da9)
- [Dashboard UI design: from KPIs to layouts that convert](https://setproduct.com/blog/dashboard-ui-design)
- [When 3D web design drives real UX performance](https://www.designrush.com/best-designs/websites/trends/how-3d-web-design-drives-real-ux-performance)
- [Motion for React: quick start](https://motion.dev/docs/react-quick-start)
- [shadcn/ui theming](https://ui.shadcn.com/docs/theming)
- [shadcn/ui CLI](https://ui.shadcn.com/cli)
