# Session handoff — read this first

Written 15 Nov 2026, at the end of a UI/branding session. It covers what the
repo is, where things deploy, what was just changed, what is still broken, and
how to verify your work. Keep it updated as the source of truth for the next
session.

---

## 1. What this project is

**Kwaravend** — a marketplace where every Nigerian seller gets their own real
store website (`/s/<slug>`) with catalogue, bookings, chat, POS, staff accounts
and a blue-tick verification system. Buyers browse a shared marketplace, follow
stores, pay (mock/WhatsApp-first), and leave reviews.

Monorepo, pnpm workspaces (`pnpm-workspace.yaml`), root `vercel.json` builds the
storefront.

| Path | What it is | Deploys to |
| --- | --- | --- |
| `apps/storefront` | Next.js 14 App Router — marketplace, seller dashboard, buyer account, public store sites, all API routes. **The main product.** | `https://naijacart-roan.vercel.app` |
| `apps/admin` | Next.js 14 — standalone platform admin console (`@idevtenancy/admin`). Own design-system copy, own Vercel project. | `https://naijavend-admin.vercel.app` |
| `apps/naijapay` | Payment/mock-POS surface | — |
| `apps/seller` | Expo (React Native) seller companion app | — |
| `packages/shared` | Types, brand tokens, geo/hours/password helpers, phrasebook | — |
| `packages/ai` | AI listing/styling draft logic | — |
| `supabase/migrations` | SQL schema | Supabase project |

### Storefront internals that matter

- `src/app/(marketplace)/` — public chrome (`layout.tsx` renders `SiteHeader`,
  footer, `CookieBanner`). **Route group: path names in the shell contain
  `(marketplace)` parens — always quote them in bash.**
- `src/app/dashboard/` — seller console (overview, listings, bookings, chat,
  analytics, ratings, staff, settings, AI).
- `src/app/(marketplace)/account/` — buyer console (orders, bookings, chats,
  alerts, AI, profile & settings).
- `src/app/s/[slug]/` — public store sites; deliberately outside the marketplace
  layout so each seller's store looks like its own site.
- `src/lib/auth.ts` — seller/buyer sessions. Cookies: `idev_access_token`
  (1 h), `idev_refresh_token` (30 d, sliding). Refresh-token-only sessions are
  re-minted, so do not treat a missing access cookie as logged out.
- `src/lib/admin.ts` — superadmin gate via `ADMIN_EMAILS` (storefront `/admin`).
- `src/styles/` — `base.css` → `components.css` → `brand.css` → `mobile.css`.
  Brand utilities (`.brand-*`, `brand-hero`, `brand-chip`, `brand-grad`) live in
  `brand.css`; Tailwind is configured in `tailwind.config.js` + `tailwind.css`.
- `src/components/brand/` — `HeroScene`, `Motion` (`ScrollProgress`, `Marquee`),
  `FaqExplorer`, `AudienceTabs`, `LayerStack`.
- `src/components/ui/` — shadcn-style primitives (`components.json`).

---

## 2. Where things are deployed (and how)

Both apps deploy with the Vercel CLI from their own folder. **Git auto-deploy is
NOT wired up** — the Vercel account has no GitHub login connection, so a push
does not deploy anything by itself.

```bash
# storefront
cd apps/storefront && vercel --prod --yes

# admin (separate Vercel project: naijavend-admin)
cd apps/admin && vercel --prod --yes
```

Long commands exceed the tool timeout — run builds/deploys in the background
writing to a log file, then poll the log.

Both deployments sit behind Vercel Deployment Protection, so plain `curl` gets
an auth wall. Verify with:

```bash
vercel curl "https://naijacart-roan.vercel.app/home"  -s -o /tmp/x.html -w "HTTP %{http_code}\n"
vercel curl "https://naijavend-admin.vercel.app/signin" -s -o /tmp/y.html -w "HTTP %{http_code}\n"
```

Env vars already set in the `naijavend-admin` project: `ADMIN_EMAILS`,
`SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`. `NEXT_PUBLIC_MARKETPLACE_URL` is optional and
absent. Production values are encrypted — `vercel env pull` returns
`[SENSITIVE]` placeholders.

---

## 3. Logins (the recurring question)

| Who | Email | Password |
| --- | --- | --- |
| Seller demo | `amaka@demo.test` | `demo1234` |
| Buyer demo | `demo@demo.test` | `demo1234` |
| Platform admin | `naijavend2026@gmail.com` | **not in the repo** — Supabase Auth password, reset 15 Nov 2026 (value held by the owner, not committed here) |

The admin password is **not stored anywhere in this codebase** (checked the
whole tree and git history: no `.env` was ever committed except a Vercel build
metadata dump with no credentials). Auth is
`signInWithPassword()` against Supabase, then the `ADMIN_EMAILS` allow-list.
To regain access, reset that user's password in Supabase → Authentication →
Users (or `auth.admin.updateUserById(id, { password })` with the service-role
key; that is what was done on 15 Nov 2026). Deliberately **not** recorded in
this file — never commit a live credential. The admin allow-list email was confirmed from `admin_audit_log`
(`actor_email`), which is the only record of an admin action.

---

## 4. What this session changed

1. **`/` is the landing page again** (About/Kwaravend story, 819 lines, restored
   from dangling commit `231f8f3`). Signed-in sellers are redirected to
   `/dashboard` by the page itself.
2. **Landing redirect for returning visitors** — `apps/storefront/src/middleware.ts`
   (matcher `'/'` only): first visit serves About and sets
   `nv_landing_seen` (1 year); later visits 307 to `/home`. Requests carrying
   `idev_access_token` / `idev_refresh_token` are let through so the page can
   still send sellers to `/dashboard`.
3. **Header nav: About → FAQ.** `SiteHeader.tsx` `LINKS` now points at `/faq`.
   The About page is untouched and still reachable at `/about` (footer,
   `/home` tour CTA and `/faq` hero all link to it).
4. **`/home` is the marketplace home**, `/discover` was redesigned in the brand
   language, `/faq` is its own page.
5. **Light/dark moved into settings**: seller `dashboard/settings` → "Look &
   feel"; buyer `account/profile` ("Profile & settings") → "Appearance". Both
   use `src/components/ThemeSetting.tsx` (`sf-theme` localStorage +
   `data-theme`). Floating toggles were removed from the marketplace header,
   account tab bar and dashboard chrome (staff keep the sidebar icon);
   `ThemeToggle.tsx` was deleted.
6. **Mobile polish** for every page: `src/styles/mobile.css` max-width
   overrides (16 px form text, touch-sized chips, scrollable tab rails,
   safe-area cookie banner).
7. **Admin console brand refresh** — `apps/admin/src/app/admin-skin.css`
   rewritten to the storefront brand language (gradient accents, Sora metrics,
   blueprint grid hero, refreshed tables/breakpoints). CSS-only; no class names
   changed, so all eight sections still work.

---

## 5. Known problems / next steps

- **Resolved this session — do not reintroduce:** the storefront production
  build failed on Vercel with `'Icon' cannot be used as a JSX component` in
  `AccountNav.tsx` / `DashNav.tsx`. Cause: `react@18.3.1` paired with
  `@types/react@19.x`, so no icon type (`ComponentType`, even a plain
  `ReactElement` function) is a valid JSX element. Local `tsc` passed because
  the local tree also had 18.x types; only Vercel's fresh `--frozen-lockfile`
  install exposed it. Fix: `@types/react` and `@types/react-dom` are pinned to
  `^18.3.0` in `apps/storefront/package.json`. If you add a React-19-only
  library, upgrade `react`/`react-dom` together — never the types alone.
- **Working tree carries a lot of uncommitted, unrelated work**: brand
  components, `src/components/ui/`, tailwind config, `AdminConsole.tsx`,
  dashboard pages, `packages/shared/src/phrasebook.ts`, `pnpm-lock.yaml`,
  `tmp/`, `apps/storefront/.vendor/`. Never commit those with a focused fix.
- **`apps/admin` has stale copies of the storefront design system**
  (`base.css` 393 lines vs storefront 401, `components.css` 1492 vs 2557).
  Syncing them was considered and rejected as too risky; treat the admin as its
  own system.
- Admin has no Settings section and no theme toggle relocation (deliberate —
  scope was a visual refresh only).
- The logo links to `/`, which now forwards returning visitors to `/home`.
  That is intended, but worth remembering when testing "About".

---

## 6. Verification checklist

```bash
cd apps/storefront && npx tsc --noEmit --incremental false   # tsbuildinfo can hide errors
cd apps/admin     && npx next build                          # admin has no test suite

# after deploy — expect 200 each
for p in / /home /faq /about /discover; do
  vercel curl "https://naijacart-roan.vercel.app$p" -s -o /dev/null -w "$p %{http_code}\n"
done

# landing redirect behaviour
vercel curl "https://naijacart-roan.vercel.app/" -s -o /dev/null -w "first visit: %{http_code}\n"
vercel curl "https://naijacart-roan.vercel.app/" -H "Cookie: nv_landing_seen=1" -s -o /dev/null \
  -w "returning visit: %{http_code} -> %{redirect_url}\n"
```

There is no test runner configured for either app; `detected_test_files` in the
repo are incidental. Verification = typecheck + build + HTTP checks on the
deployed URL.

---

## 7. Gotchas

- Bash on Windows (Git Bash). Quote any path containing `(marketplace)`.
- Never pass absolute `/c/...` paths as a tool `cwd`; `cd` inside the command.
- Builds take 2–4 minutes; run them as background jobs with a log file.
- Supabase service-role key lives in `apps/storefront/.env.local` only — the
  admin app has no local env file, so `npm run dev` there will not authenticate.
- Vercel runs `pnpm install --frozen-lockfile`: any `package.json` change must be
  committed together with the regenerated `pnpm-lock.yaml`, or the deploy dies
  during install rather than build.
