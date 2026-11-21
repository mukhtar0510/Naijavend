# Inspiration notes (REDESIGN_V2 §1.3)

Ideas to borrow, never visuals or assets. Each reference is a **pattern** seen in a type of product, not
a copy of a specific screen. No artwork, icons, pins, avatars, logos or exact layouts are taken from anyone.

**Owner action:** V2 asks for 8–10 reference screenshots before V3. Drop them in `docs/inspiration/` and
add one line each under the matching item below; the AI cannot take screenshots of other products for you.

| # | Pattern (where it is common) | What to borrow | Where it lands |
| --- | --- | --- | --- |
| 1 | Map-first ride and delivery apps | Full-bleed map, floating search pill, a 3-snap bottom sheet that becomes a left panel on desktop | `/map` (§7) |
| 2 | Local shopping discovery apps (case study in V2 sources) | Location selector pinned top, filters as horizontal tags, a search modal with recent searches and nearby areas | Buyer shell, `/home` (§4.1, §6) |
| 3 | Food-delivery home screens | A "open near you" snap carousel with one quick action per card, category chips directly under search | `/home` "Open now" row |
| 4 | Merchant admin apps with a "Today" home | Needs-attention strip first, 4 KPIs with a comparison, one hero chart, one primary action per order card | `/dashboard` (§8) |
| 5 | Command-palette dashboards | Ctrl/Cmd+K to jump to orders, customers and actions; a collapsible icon rail | Seller desktop shell (§4.2) |
| 6 | Developer-tool landing pages with a product mockup hero | Faint grid background with a radial fade, a browser-frame mockup with a tilted phone overlapping it, a short staggered load-in | `/` hero (§5.1) — matches the owner's own screenshot |
| 7 | Isometric "city" illustrations on fintech and logistics sites | Small low-rise blocks with lit windows and pins rising from them; works as SVG on slow phones | `/home` diorama, `/about`, empty states |
| 8 | Pricing pages with hover-tilt cards | One featured card with a coloured ring, the others dim on hover, a compare table under the cards | Plans (§5.2) |
| 9 | Parcel-tracking pages | Big status header, vertical timeline with icons and times, rider card with call and chat | `/track/<token>` (§9) |
| 10 | Mobile checkout steppers | Short 4-step flow, area chips instead of a free address field, sticky total bar | Checkout (§9) |

Sources named in REDESIGN_V2: the local shopping discovery UX case study, the KPI dashboard layout
guide, the 3D web design and performance article, Motion for React quick start, shadcn/ui theming and CLI.
