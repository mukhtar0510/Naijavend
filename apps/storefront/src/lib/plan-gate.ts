// Server-side plan gate for API routes: the dashboard hides locked features,
// and this stops a typed request. Returns a 403 response, or null when allowed.
import { apiError } from './api';
import { FEATURES } from './flags';
import { hasFeature, planNameFor, type FeatureKeyPlan } from './plans';

const LABEL: Record<FeatureKeyPlan, string> = {
  crm: 'The customer CRM',
  dispatch: 'Dispatch and riders',
  reports: 'Deeper analytics',
  discounts: 'Discount codes',
  custom_domain: 'Your own domain',
  priority_support: 'Priority support',
  kwaravend_rider: 'Kwaravend riders',
};

export const PLAN_COLUMNS = 'id, plan, plan_expires_at, rider_expires_at';
export type PlanStore = { id: string; plan?: string | null; plan_expires_at?: string | null; rider_expires_at?: string | null };

export function planLocked(store: PlanStore | null | undefined, key: FeatureKeyPlan) {
  if (hasFeature(store, key, FEATURES.planGating)) return null;
  return apiError(403, 'plan_required', `${LABEL[key]} is on the ${planNameFor(key)} plan. Upgrade in Plan.`);
}
