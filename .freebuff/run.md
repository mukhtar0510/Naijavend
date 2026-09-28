# Naijavend — dev server run doc

Monorepo (pnpm workspaces). The web storefront is the previewable app: Next.js 14 App Router at `apps/storefront`, backed by a hosted Supabase project (data lives remotely; no local DB needed).

## Reproduce artifacts

1. Copy env file from the main checkout: `apps/storefront/.env.local` (contains `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`; never commit or paste values here).
2. Install dependencies (from repo root): `pnpm install` (workspace deps `@idevtenancy/shared` and `@idevtenancy/ai` are linked via `workspace:*`).
3. Typecheck (optional sanity): `pnpm --filter @idevtenancy/storefront typecheck`.

## Run the server

- Default port is 3000 (`pnpm --filter @idevtenancy/storefront dev`). If 3000 is busy, use 3100: `npx next dev -p 3100` from `apps/storefront`.
- Start DETACHED so it outlives the session (Windows):

  ```
  powershell -NoProfile -Command "(Start-Process -FilePath 'npx.cmd' -ArgumentList 'next','dev','-p','3100' -WorkingDirectory 'C:\Users\mukhtar\Desktop\llm\apps\storefront' -RedirectStandardOutput 'C:\Users\mukhtar\Desktop\llm\.freebuff\preview.log' -RedirectStandardError 'C:\Users\mukhtar\Desktop\llm\.freebuff\preview.log.err' -WindowStyle Hidden -PassThru).Id"
  ```

  (stdout and stderr must point at different files.)
- Wait for `http://localhost:<port>` to answer 200 before registering the preview.

## Demo logins (password `demo1234` for all; the app was formerly named Sokoo, then Vendora, then Shopfront)

- Seller (themed demo store): `amaka@demo.test` — dashboard at `/dashboard`, customisation at `/dashboard/settings`, public site at `/s/amaka-glow-studio`.
- Other sellers: `tunde@demo.test`, `ngozi@demo.test`.
- Consumer: `demo@demo.test` — account at `/account` (orders, bookings, profile).

## PWA assets
- Icons are generated PNGs in `apps/storefront/public/icons/` (7 files: 192/512, maskable, apple-touch, favicons). Regenerate after brand changes: `cd apps/storefront && node scripts/generate-icons.mjs` (no dependencies needed).
- Service worker: `apps/storefront/public/sw.js` (bump `VERSION` const when changing shell/strategy). Manifest: `apps/storefront/src/app/manifest.ts`.
- The service worker registers in PRODUCTION builds only. In dev, `PwaRegister` unregisters any leftover SW and clears caches (stale dev SWs used to break client navigations with 404s).

## Brand & features (September 2026)
- The app is **Naijavend** (formerly Shopfront). Brand strings live in `SiteHeader`, `(marketplace)/layout.tsx` footer, `layout.tsx` metadata and `manifest.ts`.
- Map tab on `/discover`: Leaflet 1.9 + OpenStreetMap tiles (deps: `leaflet`, `@types/leaflet` in apps/storefront). Component: `src/components/StoreMap.tsx` (client-only, map initialised in useEffect).
- Blue-tick verification: `stores.verification_status` + `verified_at` (migration `20260920000001_store_verification.sql`). Rule: 30+ reviews averaging 4.0+. Apply via `POST /api/verification/apply`; dashboard card `dashboard/VerifyCard.tsx`; badge component `VerifiedTick.tsx`. Demo: `zaras-cake-studio` is grandfathered as verified.

## Google sign-in ("Continue with Google")
- UI/flow is fully built: `GoogleSignInButton` on both sign-in pages → Supabase OAuth (PKCE) → `/auth/callback` exchanges the code in-browser → `POST /api/auth/oauth-session` verifies the token server-side and sets the role's httpOnly cookies (seller vs customer via `?next=`).
- To ACTIVATE it, one-time config: in Google Cloud Console create an OAuth client (Web) with authorized redirect `https://<project-ref>.supabase.co/auth/v1/callback`; then in Supabase Dashboard → Authentication → Providers → Google, paste the client ID + secret and save. Until then the button shows a friendly "not enabled yet" message and email sign-in keeps working.

## Announcements, magic links, referrals, FAQ (September 2026)
- Announcement editor: dashboard/settings (`AnnouncementCard.tsx`) → saves via `POST /api/settings` with `announcement_starts_at` / `announcement_ends_at` (ISO or null). Store pages render the ribbon only inside the window (null = always). Zara's store demo has an expired one (hidden); Amaka's is always-on.
- Magic link: `MagicLinkForm` on both sign-in pages → `auth.signInWithOtp` with `emailRedirectTo /auth/callback?next=…` — same hand-off as Google. Works with Supabase's built-in emailer (rate-limited in dev).
- Referrals: `referral_codes` (public read) + `referrals` tables (migration 20260920000002). Capture: `RefCapture` on customer sign-in stores `?ref=` for 30 days; `POST /api/account/auth/signup` accepts `refCode` and credits via service role. Account page shows the code/link (`ReferralCard`) + invited count.
- Account product rows: `RecordProductView` on listing pages → "Recently viewed products" row; "Buy again" row built server-side from order_items. Both use ProductCard with stock badges.
- FAQ at `/faq` (linked in footer "Help & legal" + sitemap).

## Vercel deploy (September 2026)
- `vercel.json` at the ROOT makes the repo deployable: install = `pnpm install --frozen-lockfile`, build = `pnpm --filter @idevtenancy/storefront build`, framework nextjs. Import the repo ROOT in Vercel — no Root Directory override needed.
- Required env vars in Vercel project settings: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY (secret), NEXT_PUBLIC_SITE_URL (set to the deployed URL). Template: apps/storefront/.env.local.example. Full guide: README.md.
- This folder is NOT a git repo yet — the user must `git init` + push to GitHub before Vercel can import it.
- Gotcha: `next build` shares `.next` with the dev server — after a local production build, restart the dev server.

## Env vars & error styling (September 2026)
- Vercel project `naijavend` (prj_Uvgd3bYjt7SGjSSoEaPXnkk3oPGP) now has NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_SITE_URL (production) — values verified byte-identical to apps/storefront/.env.local. `SUPABASE_SERVICE_ROLE_KEY` is still MISSING locally and on Vercel: paste it from Supabase → Project Settings → API keys, then redeploy.
- vercel.json uses root-level buildCommand (no functions block — with root buildCommand, Next counts routes from .next/ root).
- Alerts (.alert/.alert-error/.alert-success in chrome.css) are branded message cards: tinted bg, 4px colour accent bar, leading circular icon badge, entrance animation + error shake, reduced-motion safe, dark-mode via tokens. Inline validation notes use the new .field-error class.

## Production deploy (September 2026)
- DEPLOYED and LIVE: https://naijavend-roan.vercel.app (project `naijavend`, prj_Uvgd3bYjt7SGjSSoEaPXnkk3oPGP, team mukhtar's projects).
- Deployed via `vercel deploy --prod` from local source (repo is not git yet). Root package.json now carries `next ^14.2.0` so Vercel's framework detection passes from the monorepo root.
- Env vars on Production (verified via API/MCP): NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_SITE_URL. STILL MISSING: SUPABASE_SERVICE_ROLE_KEY (empty locally too — must be pasted from Supabase → Settings → API keys, then `vercel deploy --prod` again).
- Working on prod: all pages, store sites, catalogue, sign-in (anon auth), map, discovery. Blocked pending service key: /api/create-order, /api/create-booking, /api/checkout-summary, /api/submit-rating, /api/mock-pay, /api/account/auth/signup (they call supabaseService()).
- After adding the key: add https://naijavend-roan.vercel.app in Supabase → Authentication → URL Configuration (Site URL + Redirect URLs) so magic links/Google work in prod.

## Naijavend rebrand (September 2026)
- Full rename Naijacart → Naijavend across all surfaces (wordmark, manifest, SW, legal, FAQ, Expo app, handles). Contact email everywhere: naijavend2026@gmail.com.
- Vercel project/URL intentionally still `naijacart-roan.vercel.app` (renaming changes prod URL + breaks NEXT_PUBLIC_SITE_URL + Supabase redirects). Rename together with the user when they're ready.
- 25 API routes verified: clean 4xx JSON on bad input, zero 500s. All dashboard pages 200 signed-in. 16/16 shared tests pass.

## Tier-2 POS + staff (Sept 21)
- Growth-plan sellers get a POS terminal (`/dashboard/pos`) and staff management (`/dashboard/staff`); APIs: `/api/pos/charge`, `/api/staff`. Charges are real `paid` orders with `channel='pos'` + `pos_staff_id`; RLS enforces owner-or-active-staff at the DB layer (`pos_staff.sql` + `pos_staff_read_policies`).
- Staff sign in via the normal seller sign-in; they see a reduced dashboard (POS + Orders only, guarded client-side and API-side).
- Demo staff: naijavend.staff.demo@gmail.com (temp password issued via the invite flow) linked to Amaka Glow Studio as cashier.
