# Naijavend Control (standalone admin)

Separate Next.js app for platform administration — deployed as its own Vercel
project, decoupled from the storefront.

## Auth

Email + password via Supabase Auth (`signInWithPassword`), then the
`ADMIN_EMAILS` allow-list on top. The session is an httpOnly cookie
(`idev_admin_token`) holding the Supabase access token, validated on every
server request and API call.

## Environment variables (set in Vercel project settings)

| Var | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Same Supabase project as the storefront |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side admin operations (ban/unban/delete, metrics) |
| `ADMIN_EMAILS` | Comma-separated allow-list of admin emails |
| `NEXT_PUBLIC_MARKETPLACE_URL` | (optional) marketplace base URL for store links |

## Local dev

```bash
cd apps/admin
npm install
cp ../../.env.example .env.local  # then fill values
npm run dev                       # http://localhost:3200
```

## Deploy (own Vercel project)

```bash
cd apps/admin
vercel link        # create/select the `naijavend-admin` project
vercel deploy --prod
```

The admin user must exist in Supabase Auth with a password set (Dashboard →
Authentication → Add user, or `auth.admin.createUser({ email, password })`).
