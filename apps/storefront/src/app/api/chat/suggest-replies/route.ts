// Seller-inbox suggested replies — drafts answers grounded in this store's own
// catalogue and policies, and the SELLER decides what to send. Nothing here
// posts to chat: the response is only ever rendered as tap-to-use chips.
import { NextRequest } from 'next/server';
import { getSellerClient, getOwnStore } from '@/lib/auth';
import { apiError, apiOk, internalError } from '@/lib/api';
import { rateLimit, clientIp } from '@/lib/ratelimit';
import { aiComplete } from '@idevtenancy/ai';
import { BUSINESS_DAYS, sanitizeText, type BusinessHours } from '@idevtenancy/shared';
import { recordFlag, scanText } from '@/lib/moderation';

interface Hours {
  mon?: [string, string] | null;
  tue?: [string, string] | null;
  wed?: [string, string] | null;
  thu?: [string, string] | null;
  fri?: [string, string] | null;
  sat?: [string, string] | null;
  sun?: [string, string] | null;
}

/** `Mon 09:00-17:00 · Sat 10:00-14:00` — the policy line the model must quote back. */
function hoursLine(hours: BusinessHours | null): string {
  if (!hours) return '';
  const h = hours as Hours;
  const short = (d: string) => d.charAt(0).toUpperCase() + d.slice(1, 2).toLowerCase();
  const parts: string[] = [];
  for (const day of BUSINESS_DAYS) {
    const slot = h[day];
    if (slot) parts.push(`${short(day)} ${slot[0]}-${slot[1]}`);
  }
  return parts.join(' · ');
}

const naira = (kobo: number) => `₦${Math.round((Number(kobo) || 0) / 100).toLocaleString('en-NG')}`;

export async function POST(req: NextRequest) {
  const rl = rateLimit(`suggest-replies:${clientIp(req)}`, 20, 60_000);
  if (!rl.allowed) {
    return apiError(429, 'rate_limited', `Give it ${rl.retryAfterSeconds}s before asking again.`);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError(400, 'invalid_json', 'Request body must be JSON.');
  }
  const b = body as Record<string, unknown>;
  // Optional: which customers' thread — `null` means the anonymous thread.
  const customerId = typeof b.customerId === 'string' && /^[0-9a-f-]{36}$/i.test(b.customerId) ? b.customerId : null;

  try {
    const sb = await getSellerClient();
    if (!sb) return apiError(401, 'unauthenticated', 'Sign in first.');

    const store = await getOwnStore<{
      id: string; name: string; category: string; description: string;
      delivery_info: string | null; business_hours: BusinessHours | null;
    }>(sb, 'id, name, category, description, delivery_info, business_hours');
    if (!store) return apiError(404, 'no_store', 'Create your store first.');

    // Thread: the last customer message is what the replies must answer.
    // Signed-in buyers get their own thread; anonymous chat is `customer_id
    // IS NULL`. Applying BOTH filters (the previous shape) returned nothing at
    // all for signed-in buyers, so no suggestions ever appeared.
    const base = sb
      .from('chat_messages')
      .select('id, sender, body, created_at')
      .eq('store_id', store.id);
    const threadQuery = customerId
      ? base.eq('customer_id', customerId)
      : base.is('customer_id', null);
    const { data: thread, error: threadErr } = await threadQuery
      .order('created_at', { ascending: true })
      .limit(30);
    if (threadErr) throw threadErr;

    const customerRows = (thread ?? []).filter((m) => m.sender === 'customer');
    const lastCustomer = customerRows[customerRows.length - 1];
    if (!lastCustomer) {
      // Nothing to answer yet — chips would be fabrications.
      return apiOk({ suggestions: [], scan: { flagged: false, labels: [] } });
    }

    // Catalogue: what is actually sellable right now.
    const { data: listings } = await sb
      .from('listings')
      .select('id, title, price_kobo, stock, type')
      .eq('store_id', store.id)
      .order('created_at', { ascending: false })
      .limit(12);

    const catalog = (listings ?? [])
      .map((l) => `${String(l.title)}, ${naira(l.price_kobo)}${l.stock != null ? `, ${l.stock} left` : ''}`)
      .join('; ');

    const policy = [store.delivery_info, hoursLine(store.business_hours)].filter(Boolean).join(' · ');

    const history = (thread ?? [])
      .slice(-8)
      .map((m) => `${m.sender === 'customer' ? 'Customer' : 'Seller'}: ${String(m.body).slice(0, 200)}`)
      .join('\n');

    const startedAt = Date.now();
    const result = await aiComplete({
      feature: 'suggest_reply',
      input: [
        `[Store] ${store.name} | ${store.category} | ${store.description.slice(0, 220)}`,
        `[Catalog] ${catalog || 'no catalogue rows yet'}`,
        `[Policy] ${policy || 'no delivery or hours policy published'}`,
        `[History] ${history || 'no prior messages'}`,
        `[Customer] ${String(lastCustomer.body).slice(0, 500)}`,
      ].join('\n'),
    });

    const draft = result.draft as { suggestions?: unknown };
    const suggestions = Array.isArray(draft.suggestions)
      ? draft.suggestions.filter((s): s is string => typeof s === 'string').slice(0, 3)
      : [];

    // Scam scan runs on the same read so the seller sees a warning with the
    // replies — posting a payment number in chat is caught offline, always.
    const scan = scanText(String(lastCustomer.body), 'chat');
    if (scan.flagged) {
      await recordFlag(sb, {
        storeId: store.id,
        kind: 'chat',
        refId: String(lastCustomer.id),
        labels: scan.labels,
        excerpt: String(lastCustomer.body),
      });
    }

    const { data: userData } = await sb.auth.getUser();
    await sb.from('ai_usage_log').insert({
      store_id: store.id,
      feature: 'suggest_reply',
      input: String(lastCustomer.body).slice(0, 400),
      tokens_used: result.tokensUsed,
      provider: result.provider,
      user_id: userData.user?.id ?? null,
      latency_ms: Date.now() - startedAt,
    });

    return apiOk({ suggestions, scan: { flagged: scan.flagged, labels: scan.labels, warning: scan.warning } });
  } catch (err) {
    return internalError('chat-suggest-replies', err);
  }
}