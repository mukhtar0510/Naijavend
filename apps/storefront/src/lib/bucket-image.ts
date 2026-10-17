// Reading an image back out of our own storage bucket, safely.
//
// `ownBucketUrl` is an allow-list, not a sanitizer: it lets through only the
// Supabase Storage object URLs for THIS project, so a seller-supplied URL can
// never turn a server-side fetch into SSRF (cloud metadata endpoints, the
// Supabase management API, localhost services…). Shared by the listing draft
// (vision) and image-edit routes.
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const IMAGE_MIME = /^image\/(jpeg|png|webp|gif)$/;

export interface BucketImage {
  mimeType: string;
  base64: string;
}

export function ownBucketUrl(raw: unknown): string | null {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > 500) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:') return null;
  const host = url.hostname.toLowerCase();
  const supabaseHost = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '')
    .replace(/^https?:\/\//, '')
    .split('/')[0]
    .toLowerCase();
  const ok =
    (host === supabaseHost || host.endsWith('.supabase.co')) &&
    url.pathname.includes('/storage/v1/object/');
  return ok ? raw : null;
}

/** Fetch a stored photo for vision/editing. Returns null for anything
 * unexpected — callers degrade to text-only rather than failing the click. */
export async function loadBucketImage(raw: unknown): Promise<BucketImage | null> {
  const u = ownBucketUrl(raw);
  if (!u) return null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    let res: Response;
    try {
      res = await fetch(u, { signal: controller.signal, redirect: 'error' });
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) return null;
    const mime = (res.headers.get('content-type') ?? '').split(';')[0].trim();
    if (!IMAGE_MIME.test(mime)) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength === 0 || buf.byteLength > MAX_IMAGE_BYTES) return null;
    return { mimeType: mime, base64: buf.toString('base64') };
  } catch (err) {
    console.warn('[bucket-image] load failed:', err);
    return null;
  }
}
