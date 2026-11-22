// Seller's riders (T09): add, edit, switch active. Owner-only via RLS.
import { NextRequest } from 'next/server';
import { getSellerClient, getOwnStore } from '@/lib/auth';
import { apiError, apiOk, internalError } from '@/lib/api';
import { sanitizeText } from '@idevtenancy/shared';
import { planLocked, PLAN_COLUMNS, type PlanStore } from '@/lib/plan-gate';

const VEHICLES = ['bike', 'tricycle', 'car', 'van', 'foot'];

function cleanPhone(raw: string): string {
  const p = raw.replace(/[\s-]/g, '');
  if (/^0\d{10}$/.test(p)) return `+234${p.slice(1)}`;
  if (/^234\d{10}$/.test(p)) return `+${p}`;
  return p;
}

export async function POST(req: NextRequest) {
  const sb = await getSellerClient();
  if (!sb) return apiError(401, 'unauthenticated', 'Sign in first.');
  let b: Record<string, unknown>;
  try {
    b = (await req.json()) as Record<string, unknown>;
  } catch {
    return apiError(400, 'invalid_json', 'Request body must be JSON.');
  }
  try {
    const store = await getOwnStore<PlanStore>(sb, PLAN_COLUMNS);
    if (!store) return apiError(403, 'no_store', 'Only the store owner can manage riders.');
    const locked = planLocked(store, 'dispatch');
    if (locked) return locked;

    const id = sanitizeText(b.id, 40);
    const name = sanitizeText(b.name, 60);
    const phone = cleanPhone(sanitizeText(b.phone, 20));
    const vehicle = sanitizeText(b.vehicle, 12) || 'bike';

    if (id) {
      if (!/^[0-9a-f-]{36}$/i.test(id)) return apiError(400, 'invalid_rider', 'Invalid rider.');
      const patch: Record<string, unknown> = {};
      if (typeof b.active === 'boolean') patch.active = b.active;
      if (name) patch.name = name;
      if (phone) patch.phone = phone;
      if (b.vehicle !== undefined && VEHICLES.includes(vehicle)) patch.vehicle = vehicle;
      const { error } = await sb.from('riders').update(patch).eq('id', id).eq('store_id', store.id);
      if (error) return apiError(422, 'invalid_rider', 'Check the name and phone number.');
      return apiOk({ updated: true });
    }

    if (name.length < 2) return apiError(422, 'invalid_name', 'Enter the rider’s name.');
    if (!/^\+?\d{10,15}$/.test(phone)) return apiError(422, 'invalid_phone', 'Enter a phone number, e.g. 08012345678.');
    if (!VEHICLES.includes(vehicle)) return apiError(422, 'invalid_vehicle', 'Pick a vehicle.');
    const { data, error } = await sb
      .from('riders')
      .insert({ store_id: store.id, name, phone, vehicle })
      .select('id')
      .single();
    if (error) return apiError(422, 'invalid_rider', 'Could not add the rider. Check the details.');
    return apiOk({ id: data.id }, 201);
  } catch (err) {
    return internalError('riders', err);
  }
}
