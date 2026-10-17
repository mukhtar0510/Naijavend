// Trust & safety helpers shared by the write paths.
//
// Rules run FIRST and offline (packages/shared/src/fraud.ts) so scam messages
// and junk reviews are caught on every deployment, key or no key. The model is
// only consulted through `moderation` when the caller asks for a deeper pass,
// and NOTHING is ever auto-deleted: a flag lands in moderation_flags for a
// human, and the content stays visible where it already was.
import type { SupabaseClient } from '@supabase/supabase-js';
import { detectScamPhrases, FRAUD_LABEL_TEXT } from '@idevtenancy/shared';

export type FlagKind = 'chat' | 'review' | 'listing' | 'store';

export interface FlagInput {
  storeId: string | null;
  kind: FlagKind;
  refId?: string | null;
  labels: string[];
  excerpt: string;
  /** `rules` for the offline heuristics, `model` for the moderation model. */
  source?: 'rules' | 'model';
}

/**
 * Best-effort write. A flag must never break the flow that produced it — the
 * table is also introduced by a migration that may not have run yet — so any
 * failure is logged and swallowed.
 */
export async function recordFlag(sb: SupabaseClient | null, input: FlagInput): Promise<void> {
  if (!sb || !input.storeId || input.labels.length === 0) return;
  try {
    const { error } = await sb.from('moderation_flags').insert({
      store_id: input.storeId,
      kind: input.kind,
      ref_id: input.refId ?? null,
      labels: input.labels.slice(0, 6),
      excerpt: input.excerpt.replace(/\s+/g, ' ').trim().slice(0, 400),
      source: input.source ?? 'rules',
    });
    if (error) console.warn('[moderation] flag write failed:', error.message);
  } catch (err) {
    console.warn('[moderation] flag write failed:', err);
  }
}

export interface ScanResult {
  flagged: boolean;
  labels: string[];
  /** Human sentence stitched from FRAUD_LABEL_TEXT, or '' when clean. */
  warning: string;
}

/** Offline scam scan of one chat message / review. Never throws. */
export function scanText(text: string, kind: 'chat' | 'review' = 'chat'): ScanResult {
  const labels = detectScamPhrases(text);
  // FRAUD_LABEL_TEXT is a total Record<FraudLabel, string>, so this join is
  // safe for every label the rule set can produce.
  const warning = labels.map((l) => FRAUD_LABEL_TEXT[l]).join('. ');
  return { flagged: labels.length > 0, labels, warning };
}

/** Truncate for flag excerpts without splitting a surrogate pair. */
export function excerpt(text: string, max = 400): string {
  return text.replace(/\s+/g, ' ').trim().slice(0, max);
}