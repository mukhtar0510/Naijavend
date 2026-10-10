# AI Studio setup checklist — image gen + WhatsApp send

This is the current state for the storefront AI Studio image generation and WhatsApp send work.

## What is already wired in code

- `POST /api/ai/image-gen` — currently **disabled/blank**. It accepts a prompt,
  validates it, logs to `ai_usage_log` with provider `disabled`, and returns
  `{ image: { imageUrl: null, alt: '...' }, provider: 'disabled' }`.
  Re-enable by wiring `GEMINI_API_KEY` + image model support and removing the disabled guard.
- `POST /api/ai/status` — returns per-store image-gen + WhatsApp readiness.
- `POST /api/ai/whatsapp-send` — sends an image + caption to the seller's stored
  WhatsApp business number via the WhatsApp Cloud API. Currently gated behind
  `WHATSAPP_TOKEN` + `WHATSAPP_PHONE_ID` (or per-store `WHATSAPP_PHONE_ID_BY_STORE`).
- `AiStudio.tsx` — image generator UI, download button, “Send to WhatsApp” button,
  and an AI Studio status pill.

## Step 1 — Deploy the current code to Vercel

The project is on branch `main` and the storefront is the deploy root.

Local deploy plumbing that already exists:
- `vercel.json` at repo root
- `apps/storefront/next.config.mjs`
- `package.json` with `build:storefront`
- `.vercel/` already present locally

One local-only note: the `.vercel/output/` that exists now is from a previous failed
`vercel build` run, not from a completed deploy. Do not assume it proves anything
about the current deploy.

Exact flow:
1. If the Vercel CLI is not authenticated yet:
   - `vercel login`
   - or set `VERCEL_TOKEN` from the Vercel dashboard (**Account Settings → Tokens**)
2. From the repo root, link or confirm the project:
   - `cd apps/storefront && vercel link`
   - if the project already exists, follow the prompts to link it
3. Deploy:
   - preview: `cd apps/storefront && vercel`
   - production: `cd apps/storefront && vercel --prod`
4. After env vars are added, redeploy so they take effect.

Vercel env docs to follow:
- Environment variables are set per environment (Production / Preview).
- Environment variable changes do not affect an already-running deployment; deploy again.
- CLI: `vercel env add <name> <environment>` or set them in the Vercel dashboard.

## Step 2 — Add Vercel environment variables

Set these in **Vercel → project → Settings → Environment Variables**.

Required to re-enable image gen:
- `GEMINI_API_KEY`

Optional for image gen:
- `GEMINI_IMAGE_MODEL`

Required for WhatsApp send:
- `WHATSAPP_TOKEN`
- `WHATSAPP_PHONE_ID`

Optional for WhatsApp send:
- `WHATSAPP_PHONE_ID_BY_STORE`

Where to get them:
- Gemini API key — Google AI Studio: https://aistudio.google.com/apikey
- WhatsApp Cloud API token + phone id — Meta for Developers:
  https://developers.facebook.com/docs/whatsapp/get-started

Important WhatsApp note:
- The phone id is the Cloud API phone number id, not the phone number itself.
- Find it in Meta App Dashboard → WhatsApp → API Setup, or via the WhatsApp
  Phone Number Management API.

## Step 3 — Confirm Supabase store-media bucket

WhatsApp send needs a publicly reachable image URL. Today, generated images are
blank, so this is only relevant once image gen is re-enabled and actually returns
a real image.

Quick check:
1. Open Supabase Dashboard → Storage.
2. Confirm there is a bucket named `store-media`.
3. Confirm it is public.
4. If listing image uploads already work and return public
   `supabase.co/storage/v1/object/public/...` URLs, the bucket is probably
   already usable.

If the bucket does not exist or needs the per-user upload policy:
- Create bucket `store-media` and set it public.
- Add an insert policy so authenticated sellers can only upload into their own
  user-id folder path.

Example policy SQL:
```sql
create policy "authenticated sellers can upload into their own folder"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'store-media'
  and storage.foldername(name)[1] = auth.jwt()->>'sub'
);
```

## Step 4 — Verify after deploy + env

Once `GEMINI_API_KEY` is set in Vercel and the app is redeployed:
1. Sign in as a seller.
2. Open AI Studio.
3. Check the status pill shows image gen enabled if the key is present.
4. Generate an image.
5. If image gen is still disabled in code, expect provider `disabled` and no image.
6. If image gen is re-enabled, confirm the image bubble renders and the download
   / WhatsApp buttons behave as expected.

For WhatsApp send:
- Set `WHATSAPP_TOKEN` + `WHATSAPP_PHONE_ID`.
- Make sure the seller store has a WhatsApp business number saved.
- Try “Send to WhatsApp” from a generated or downloaded image URL.

## Current limitation

- Image generation is intentionally blank right now. Without re-enabling it,
  AI Studio can still open the image tool, but it will not produce a usable
  image to download or send.
- WhatsApp send is wired and typed, but not usable until the WhatsApp env is set
  and there is a reachable image to send.
- This checklist does not include actual credentials. Those still come from the
  external providers in Step 2 and Step 3.

## Exact env var block to copy into Vercel

```
GEMINI_API_KEY=
GEMINI_IMAGE_MODEL=
WHATSAPP_TOKEN=
WHATSAPP_PHONE_ID=
WHATSAPP_PHONE_ID_BY_STORE=
```

For local-only reference, the same names are already documented in `.env.example`.
