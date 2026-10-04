// Onboarding: AI-assisted store creation (blueprint screen 1).
// The dummy AI drafts name/description/category server-side; the seller edits before
// this endpoint is called with their final values. Every AI call is logged to ai_usage_log.
import { NextRequest } from 'next/server';
import { getSellerClient } from '@/lib/auth';
import { apiError, apiOk, internalError } from '@/lib/api';
import { sanitizeText, isBusinessType, isValidSlug } from '@idevtenancy/shared';
import { aiComplete } from '@idevtenancy/ai';
import { rateLimit, clientIp } from '@/lib/ratelimit';

export async function POST(req: NextRequest) {
  const sb = await getSellerClient();
  if (!sb) return apiError(401, 'unauthenticated', 'Sign in first.');

  // AI calls here cost money when any useAi* flag is set — throttle like the
  // dedicated AI routes.
  const rl = rateLimit(`onboarding:${clientIp(req)}`, 10, 60_000);
  if (!rl.allowed) {
    return apiError(429, 'rate_limited', `Too many attempts. Try again in ${rl.retryAfterSeconds}s.`);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError(400, 'invalid_json', 'Request body must be JSON.');
  }
  const b = body as Record<string, unknown>;

  const businessDescription = sanitizeText(b.businessDescription, 600);
  const name = sanitizeText(b.name, 120);
  const slugInput = sanitizeText(b.slug, 80).toLowerCase();
  const businessType = b.businessType;
  const isDropshipper = b.isDropshipper === true;
  const category = sanitizeText(b.category, 40);
  const description = sanitizeText(b.description, 2000);
  const useAiName = b.useAiName === true;
  const useAiDescription = b.useAiDescription === true;
  const useAiCategory = b.useAiCategory === true;

  if (businessDescription.length < 10) {
    return apiError(400, 'missing_description', 'Describe your business in at least 10 characters so the AI can draft your store.');
  }
  if (!isBusinessType(businessType)) {
    return apiError(422, 'invalid_type', 'Choose product, service, or hybrid.');
  }
  if (!isValidSlug(slugInput)) {
    return apiError(422, 'invalid_slug', 'Store link can use lowercase letters, numbers, and hyphens only.');
  }
  if (!useAiName && name.length < 2) return apiError(422, 'invalid_name', 'Store name needs at least 2 characters.');
  if (!useAiDescription && description.length < 10) {
    return apiError(422, 'invalid_description', 'Write a store description (at least 10 characters) or use the AI draft.');
  }

  try {
    const { data: authData } = await sb.auth.getUser();
    const userId = authData.user?.id;
    if (!userId) return apiError(401, 'unauthenticated', 'Sign in first.');

    const { data: existing } = await sb.from('stores').select('id').eq('owner_id', userId).maybeSingle();
    if (existing) return apiError(409, 'store_exists', 'You already have a store. Manage it from the dashboard.');

    // AI draft server-side for whichever fields the seller delegated.
    let finalName = name;
    let finalDescription = description;
    let finalCategory = category;
    let tokensUsed = 0;
    let aiUsed = false;

    if (useAiName || useAiDescription || useAiCategory) {
      const result = await aiComplete({ feature: 'store_setup', input: businessDescription });
      tokensUsed = result.tokensUsed;
      aiUsed = true;
      const draft = result.draft as { name: string; description: string; category: string };
      if (useAiName) finalName = draft.name;
      if (useAiDescription) finalDescription = draft.description;
      if (useAiCategory) finalCategory = draft.category;
    }

    const slug = slugInput || finalName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'store';

    const { data: store, error } = await sb
      .from('stores')
      .insert({
        owner_id: userId,
        name: finalName,
        slug,
        business_type: businessType,
        category: finalCategory || 'general',
        description: finalDescription,
        ai_generated_description: useAiDescription,
        is_dropshipper: isDropshipper,
      })
      .select('id, slug')
      .single();
    if (error) {
      if (String(error.message).includes('duplicate key')) {
        return apiError(409, 'slug_taken', 'That store link is taken — pick another.');
      }
      throw error;
    }

    if (aiUsed) {
      // user_id is REQUIRED by the ai_usage_owner_insert policy — without it
      // RLS silently drops the row.
      const { data: userData } = await sb.auth.getUser();
      await sb.from('ai_usage_log').insert({
        store_id: store.id,
        feature: 'store_setup',
        tokens_used: tokensUsed,
        user_id: userData.user?.id ?? null,
      });
    }

    return apiOk({ storeId: store.id, slug: store.slug }, 201);
  } catch (err) {
    return internalError('onboarding', err);
  }
}
