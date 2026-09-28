# Naijavend

Storefronts for Nigerian sellers — each seller gets their own customisable store site (`/s/<slug>`) inside a shared marketplace, with products, services, bookings, chat, a live map locator, ratings, blue-tick verification, referrals, announcements, and a PWA install experience.

**Monorepo layout** (pnpm workspaces):

| Path | What it is |
| --- | --- |
| `apps/storefront` | Next.js 14 web app — the marketplace + seller dashboards + store sites. **This is what deploys to Vercel.** |
| `apps/seller` | Expo (React Native) seller companion app |
| `packages/shared` | Shared types, brand tokens, geo/hours/password utilities |
| `packages/ai` | AI styling/listing draft logic |
| `supabase/migrations` | SQL schema migrations |

## Run locally

```bash
pnpm install
cp apps/storefront/.env.local.example apps/storefront/.env.local   # then fill values
pnpm dev:storefront                                                 # http://localhost:3000
```

Demo logins (dev seed): seller `amaka@demo.test`, customer `demo@demo.test` — password `demo1234`.

## Deploy to Vercel

`vercel.json` at the repo root already tells Vercel to build the monorepo — import the **repo root**, not a subfolder.

1. **Push this folder to GitHub** (Vercel deploys from git; the folder must be a git repository):
   ```bash
   git init
   git add -A
   git commit -m "Naijavend initial"
   git remote add origin https://github.com/<you>/naijavend.git
   git push -u origin main
   ```
2. On [vercel.com/new](https://vercel.com/new), import that repository. Vercel reads `vercel.json` and runs `pnpm install --frozen-lockfile` + `pnpm --filter @idevtenancy/storefront build` from the root automatically. No "Root Directory" override needed.
3. **Add environment variables** (Project → Settings → Environment Variables). Values come from your Supabase dashboard (Project Settings → API) — the same values already in `apps/storefront/.env.local` locally:

   | Variable | Value | Notes |
   | --- | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://<project-ref>.supabase.co` | public |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon/public key | public |
   | `SUPABASE_SERVICE_ROLE_KEY` | service-role key | **secret** — server-only |
   | `NEXT_PUBLIC_SITE_URL` | `https://<your-app>.vercel.app` (or your custom domain) | powers sitemap/robots/OG/referral links |

4. Deploy. On success, verify `https://<your-app>.vercel.app` loads the marketplace.
5. **One-time Supabase setting**: add your production URL to Authentication → URL Configuration → Site URL and Redirect URLs (sign-in, magic links and Google OAuth redirect there).

Every push to `main` redeploys; PRs get preview URLs.

## Database

Schema changes are recorded in `supabase/migrations/` and applied to the hosted project (locally via the Supabase MCP tools in this workspace). Never edit production data through the app's anon client — service-role operations live in server routes only.
