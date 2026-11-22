import { STORE_TEMPLATES } from '@idevtenancy/shared';
import { effectivePlan } from '@/lib/plans';

/** A paid template only shows while the plan that allows it is active; otherwise Modern. */
export function allowedLayout(layout: string | null | undefined, store: { plan?: string | null; plan_expires_at?: string | null }): string {
  const l = layout ?? 'modern';
  const limit = effectivePlan(store).limits.templates;
  if (limit == null) return l;
  const i = STORE_TEMPLATES.findIndex((t) => t.id === l);
  return i >= 0 && i < limit ? l : 'modern';
}
