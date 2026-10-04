// Seller AI assistant — grounded in the seller's own store facts, stateless
// (the client sends the recent transcript; nothing is persisted). Every call
// is rate-limited and logged to ai_usage_log with user_id (the RLS insert
// policy requires it) plus latency.
import { NextRequest } from 'next/server';
import { getSellerClient, getOwnStore } from '@/lib/auth';
import { apiError, apiOk, internalError } from '@/lib/api';
import { rateLimit, clientIp } from '@/lib/ratelimit';
import { sanitizeText } from '@idevtenancy/shared';
import { aiComplete } from '@idevtenancy/ai';
import type { AiAssistantDraft } from '@idevtenancy/shared';

interface ChatMsg {
  role: 'user' | 'assistant';
  content: string;
}

const MAX_MESSAGES = 10;
const MAX_MSG_CHARS = 500;

export async function POST(req: NextRequest) {
  const sb = await getSellerClient();
  if (!sb) return apiError(401, 'unauthenticated', 'Sign in first.');

  const rl = rateLimit(`ai-assistant:${clientIp(req)}`, 20, 60_000);
  if (!rl.allowed) {
    return apiError(429, 'rate_limited', `Too many questions. Try again in ${rl.retryAfterSeconds}s.`);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError(400, 'invalid_json', 'Request body must be JSON.');
  }  const raw = (body as Record<string, unknown>).messages;
  if (!Array.isArray(raw) || raw.length === 0) {
    return apiError(422, 'empty_chat', 'Ask a question first.');
  }

  // First interaction — the studio welcome. No AI call, so there is nothing
  // to break whether or not a key exists; it introduces the features and how
  // to start just like a sign-up on-boarding.
  if (raw.length === 0) {
    const welcome = [
      'Welcome to AI Studio! I help you grow your store. Here is what I can do:',
      '💬  Business assistant — answers about orders, pricing, content, delivery and staffing,',
      '      grounded in your store\'s own stats (listings, orders, visits).',
      '📣  Social posts — caption drafts for WhatsApp status, Instagram and Facebook.',
      '🎨  Store styling — palette, fonts and layouts for your store site.',
      '📝  Listing descriptions — copy that sells each product or service.',
      '',
      'To begin, send me a sentence about your store, e.g. "How do I get more orders this week?"\n',
      'No API key needed for these first drafts — they improve automatically when',
      'GEMINI_API_KEY is set (Google AI Studio, free tier).',
    ].join('\n');
    return apiOk({ reply: welcome, provider: 'welcome' });
  }

  const msgs: ChatMsg[] = [];
  for (const m of raw.slice(-MAX_MESSAGES)) {
    const role = (m as ChatMsg)?.role;
    const content = sanitizeText((m as ChatMsg)?.content, MAX_MSG_CHARS);
    if ((role === 'user' || role === 'assistant') && content) msgs.push({ role, content });
  }
  if (!msgs.some((m) => m.role === 'user')) {
    return apiError(422, 'empty_chat', 'Ask a question first.');
  }

  try {
    const store = await getOwnStore<{ id: string; name: string; category: string; description: string | null }>(
      sb,
      'id, name, category, description',
    );
    if (!store) return apiError(404, 'no_store', 'Create your store first.');

    // Grounding stats — same count patterns as the dashboard overview.
    const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const [{ count: listingCount }, { data: listingIdRows }, { count: orders30 }, { count: visits30 }] =
      await Promise.all([
        sb.from('listings').select('id', { count: 'exact', head: true }).eq('store_id', store.id),
        sb.from('listings').select('id').eq('store_id', store.id).limit(500),
        sb.from('orders').select('id', { count: 'exact', head: true }).eq('store_id', store.id).gte('created_at', since30),
        sb.from('store_events').select('id', { count: 'exact', head: true }).eq('store_id', store.id).eq('event_type', 'view').gte('created_at', since30),
      ]);
    const { count: pendingBookings } = await sb
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .in('listing_id', (listingIdRows ?? []).map((l) => l.id))
      .eq('status', 'pending');

    const transcript = msgs
      .slice(-8)
      .map((m) => `${m.role === 'user' ? 'Seller' : 'Assistant'}: ${m.content}`)
      .join('\n');
    // Shared input contract: [Store]/[About]/[Stats]/[Chat] lines — parsed by
    // the dummy provider's grounding parsers and described to Gemini verbatim.
    const input = [
      `[Store] ${store.name} | category: ${store.category}`,
      store.description ? `[About] ${store.description.slice(0, 300)}` : '',
      `[Stats] listings: ${listingCount ?? 0}, orders last 30 days: ${orders30 ?? 0}, pending bookings: ${pendingBookings ?? 0}, store views last 30 days: ${visits30 ?? 0}`,
      '[Chat]',
      transcript,
    ]
      .filter(Boolean)
      .join('\n')
      .slice(0, 2600);

    const startedAt = Date.now();
    const result = await aiComplete({ feature: 'assistant_chat', input });
    const latencyMs = Date.now() - startedAt;

    const { data: userData } = await sb.auth.getUser();
    // Best-effort logging: never fail the chat because usage logging hiccuped.
    await sb.from('ai_usage_log').insert({
      store_id: store.id,
      feature: 'assistant_chat',
      input,
      tokens_used: result.tokensUsed,
      provider: result.provider,
      user_id: userData.user?.id ?? null,
      latency_ms: latencyMs,
    });

    return apiOk({ reply: (result.draft as AiAssistantDraft).reply, provider: result.provider });
  } catch (err) {
    return internalError('ai-assistant', err);
  }
}
