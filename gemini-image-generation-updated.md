# Image-generation update — current Gemini API alignment

## What changed
- `packages/ai/src/gemini.ts`: `generateImage()` now calls the documented **Interactions API** (`POST /v1beta/interactions`) with a dedicated Nano Banana image model, instead of reusing the text model id via `:generateContent`.
- Request shape is now `model` + `input` + `response_format: { type: 'image', mime_type, aspect_ratio, image_size }`.
- Response parsing now handles the modern Interactions response (`steps[].content[]` image block with base64 `data`) and still throws if no image is returned. The old backward-compat `candidates[].content.parts[].inlineData` branch was removed because the Interactions path is the documented one and the code now consistently parses it.
- `createImageProviderFromEnv` and `GeminiProvider.fromEnv` now both default to `gemini-nano-banana-2.1` unless `GEMINI_IMAGE_MODEL` is set, so the image-gen route and any direct `fromEnv` usage agree on the image model.

## Current defaults
- Image model default: `gemini-nano-banana-2.1`
- Override via env: `GEMINI_IMAGE_MODEL`
- Text model is unchanged: `GEMINI_DEFAULT_MODEL = 'gemini-3.8-flash'` for `aiComplete`

## What still needs a real end-to-end check
This is now aligned with the current docs, but it has **not** been confirmed with a live Gemini image-generation call. To verify live, add `GEMINI_API_KEY` in Vercel, redeploy, sign in as a seller, generate an image, and confirm the AI Studio image bubble returns a public `supabase.co/storage/v1/object/public/...` URL instead of a `data:` URL.

## Files
- `packages/ai/src/gemini.ts`
- `packages/ai/src/index.ts`
