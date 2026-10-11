# Supabase: store-media bucket + per-user upload policy

## What this bucket is for
- Public store media, including AI-generated images that need to be reachable by WhatsApp's crawler and downloadable by sellers.
- The existing listing upload route already writes there, so the bucket may already exist and already be usable.

## Quick confirmation path
1. In your Supabase project, open **Storage** and look for a bucket named `store-media`.
2. If listing image uploads already work today and return public `supabase.co/storage/v1/object/public/...` URLs, the bucket and policy are probably already correct — you may only need to confirm public access and the per-user folder rule below.
3. If listing uploads are broken or the bucket is missing, create/fix it using the steps below.

## If you need to create the bucket
1. Supabase dashboard → **Storage** → create bucket named exactly `store-media`.
2. Set the bucket to **public**.
3. Leave it empty for now unless you already have existing public media.

## Upload policy so each seller writes only into their own folder
Object keys used by the app are `{userId}/...`, so uploads should be allowed only when the first path segment is the authenticated user id.

```sql
-- Run in Supabase SQL Editor.
-- Adjust the bucket name if yours differs.

create policy "authenticated sellers can upload into their own folder"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'store-media'
  and storage.foldername(name)[1] = auth.jwt()->>'sub'
);
```

That policy allows uploads only to paths like `{userId}/ai/...` or `{userId}/listing/...`. A seller cannot write into another seller's folder.

If your app later needs sellers to overwrite their own AI images, or to list/delete their own folder, add the matching `SELECT / UPDATE / DELETE` policies for those operations. The current image-gen route only uploads with `upsert: false`, so insert-only is the minimal correct policy for now.

## What must be true for WhatsApp send to work after this
- The bucket is public.
- The image-gen route can upload to `{userId}/ai/...` and return a public URL.
- A real Gemini image was generated (dummy/fallback images have no url and are not sent).
- WhatsApp env is configured (`WHATSAPP_TOKEN` + `WHATSAPP_PHONE_ID`), and the seller has a WhatsApp business number saved in store settings.
