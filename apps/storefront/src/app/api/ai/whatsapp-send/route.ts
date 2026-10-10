// Send a generated image + caption to the seller's own WhatsApp business number
// via the official WhatsApp Cloud API (free tier: first 1,000 service
// conversations/month, then usage-based). V1 sends to the seller's stored
// business number so the seller can forward/share the generated image — not a
// broadcast to customers, which would require templates + opt-in handling.
import { NextRequest } from 'next/server';
import { getSellerClient, getOwnStore } from '@/lib/auth';
import { apiError, apiOk, internalError } from '@/lib/api';
import { rateLimit, clientIp } from '@/lib/ratelimit';
import { sanitizeText } from '@idevtenancy/shared';

const WHATSAPP_CLOUD_API_BASE = 'https://graph.facebook.com/v18.0';
const MAX_CAPTION = 300;

interface SendBody {
  imageUrl: string;
  caption: string;
}

export async function POST(req: NextRequest) {
  const sb = await getSellerClient();
  if (!sb) return apiError(401, 'unauthenticated', 'Sign in first.');

  const rl = rateLimit(`ai-whatsapp-send:${clientIp(req)}`, 20, 60_000);
  if (!rl.allowed) {
    return apiError(429, 'rate_limited', `Too many send attempts. Try again in ${rl.retryAfterSeconds}s.`);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError(400, 'invalid_json', 'Request body must be JSON.');
  }

  const b = body as Record<string, unknown>;
  const imageUrl = typeof b.imageUrl === 'string' && b.imageUrl.trim().length > 0 ? b.imageUrl.trim() : null;
  if (!imageUrl) return apiError(422, 'missing_image', 'An image URL is required.');

  const captionRaw = typeof b.caption === 'string' ? b.caption : '';
  const caption = sanitizeText(captionRaw, MAX_CAPTION);
  if (!caption) return apiError(422, 'missing_caption', 'A short caption is required.');

  try {
    const store = await getOwnStore<{ id: string; name: string; whatsapp_number: string | null }>(
      sb,
      'id, name, whatsapp_number',
    );
    if (!store) return apiError(404, 'no_store', 'Create your store first.');

    // Use the dedicated WhatsApp settings business number when present, otherwise
    // fall back to the legacy store-level whatsapp_number.
    const { data: waRow } = await sb
      .from('whatsapp_settings')
      .select('business_number')
      .eq('store_id', store.id)
      .maybeSingle();
    const businessNumber = ((waRow as { business_number: string | null } | null)?.business_number ??
      store.whatsapp_number)?.trim();

    if (!businessNumber) {
      return apiError(422, 'no_whatsapp_number', 'Add a WhatsApp business number in store settings first.');
    }
    if (!isValidInternationalPhone(businessNumber)) {
      return apiError(422, 'invalid_whatsapp_number', 'Your WhatsApp business number must be in international format, e.g. +2348012345678.');
    }

    // WhatsApp Cloud API needs a phone number in the `whatsapp` numbering scheme,
    // e.g. `whatsapp:+2348012345678`.
    const to = `whatsapp:${businessNumber}`;

    // The Cloud API requires a publicly reachable image URL. We do not persist
    // generated images server-side yet, so callers must pass a URL that WhatsApp's
    // crawler can fetch (data: URLs are not allowed). If the image is only a local
    // data: blob, this route rejects it with a clear error rather than failing
    // silently inside the Meta API.
    if (imageUrl.startsWith('data:')) {
      return apiError(422, 'unreachable_image', 'WhatsApp needs a public image URL. Download the image first, host it somewhere reachable, then send.');
    }

    const { data: userData } = await sb.auth.getUser();
    const token = (await sb.auth.getUser())?.data?.user ? (process.env.WHATSAPP_TOKEN as string | undefined) : undefined;

    // One WhatsApp Cloud API token usually covers one WhatsApp Business Account;
    // for a marketplace this is most likely a platform-level token. To keep the
    // seller's outgoing messages tied to the right business account, support a
    // per-store override (WHATSAPP_PHONE_ID_BY_STORE) so different stores can use
    // different phone ids if the platform ever supports more than one.
    const phoneIdByStore = (process.env.WHATSAPP_PHONE_ID_BY_STORE as Record<string, string | undefined> | undefined) || {};
    const phoneId =
      (phoneIdByStore[store.id] ?? process.env.WHATSAPP_PHONE_ID) ?? 'PHONE_ID';

    // V1 requires a WhatsApp Business Account + Cloud API token on this deployment.
    // Until then, this route returns a clear, actionable error instead of pretending
    // to send.
    if (!token) {
      return apiError(
        501,
        'whatsapp_not_configured',
        'WhatsApp sending is not configured yet. Set WHATSAPP_TOKEN + WHATSAPP_PHONE_ID on this deployment (WhatsApp Cloud API) for the store’s business number, then try again.',
      );
    }

    // Keep a lightweight per-store status in ai_usage_log-style semantics: if the
    // number is configured but sending fails with a WhatsApp API error, surface the
    // Meta error message clearly so the seller can fix phone/token/number mismatches.
    const startedAt = Date.now();
    const res = await fetch(`${WHATSAPP_CLOUD_API_BASE}/${phoneId}/messages`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'image',
        image: {
          link: imageUrl,
          caption,
        },
      }),
    });
    const latencyMs = Date.now() - startedAt;

    if (!res.ok) {
      const bodyText = await res.text().catch(() => '');
      return apiError(502, 'whatsapp_send_failed', `WhatsApp send failed: ${res.status}. ${bodyText.slice(0, 200)}`);
    }

    await sb.from('ai_usage_log').insert({
      store_id: store.id,
      feature: 'whatsapp_send',
      input: caption,
      tokens_used: 0,
      provider: 'whatsapp-cloud',
      user_id: userData.user?.id ?? null,
      latency_ms: latencyMs,
    });

    return apiOk({ sent: true, provider: 'whatsapp-cloud' });
  } catch (err) {
    return internalError('whatsapp-send', err);
  }
}

// Lightweight validation: international format with a country code and at least
// the rest of the digits. Not a full E.164 validator, but good enough to reject
// obviously wrong values before calling the Meta API.
function isValidInternationalPhone(raw: string): boolean {
  const s = raw.replace(/\s+/g, '');
  return /^[\+][1-9]\d{6,14}$/.test(s);
}
