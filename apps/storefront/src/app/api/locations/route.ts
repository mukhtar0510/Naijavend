// store locations — multi-branch support (Store 1, Store 2, …).
// Owner-only writes via the seller client (RLS double-enforces ownership);
// public read happens through the anon client on the store site.
import { NextRequest } from 'next/server';
import { getSellerClient, getOwnStore } from '@/lib/auth';
import { revalidateStore } from '@/lib/revalidate';
import { apiError, apiOk, internalError } from '@/lib/api';
import { sanitizeText, isValidPhone } from '@idevtenancy/shared';

const MAX_LOCATIONS = 10;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function safeHours(v: unknown): Record<string, [string, string]> {
  if (typeof v !== 'object' || v === null) return {};
  const raw = v as Record<string, unknown>;
  const out: Record<string, [string, string]> = {};
  for (const day of ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']) {
    const range = raw[day];
    if (
      Array.isArray(range) && range.length === 2 &&
      typeof range[0] === 'string' && typeof range[1] === 'string' &&
      TIME_RE.test(range[0]) && TIME_RE.test(range[1]) && range[1] > range[0]
    ) {
      out[day] = [range[0], range[1]];
    }
  }
  return out;
}

interface LocationInput {
  label: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  phone: string;
  note: string;
  imageUrl: string | null;
  businessHours: Record<string, [string, string]>;
}

function parseLocation(b: Record<string, unknown>): { loc: LocationInput | null; phoneInvalid?: boolean } {
  const label = sanitizeText(b.label, 60);
  if (!label) return { loc: null };
  const address = sanitizeText(b.address, 300);
  const lat = typeof b.latitude === 'number' && b.latitude >= -90 && b.latitude <= 90 ? b.latitude : null;
  const lng = typeof b.longitude === 'number' && b.longitude >= -180 && b.longitude <= 180 ? b.longitude : null;
  // Normalise common typing styles: "0801 234 5678", "+234-801-234-5678",
  // "(0801) 234 5678" → digits + optional leading +, then validate.
  // Local numbers (no +) get the +234 prefix so all phone links dial correctly.
  const rawPhone = sanitizeText(b.phone, 24).replace(/[\s().-]/g, '');
  let phone = '';
  let phoneInvalid = false;
  if (rawPhone) {
    const digitsOnly = rawPhone.replace(/[^0-9+]/g, '');
    const candidate = digitsOnly.startsWith('+')
      ? digitsOnly
      : digitsOnly.startsWith('234')
        ? `+${digitsOnly}`
        : digitsOnly.startsWith('0')
          ? `+234${digitsOnly.slice(1)}`
          : digitsOnly;
    if (isValidPhone(candidate) && candidate.length <= 16) {
      phone = candidate;
    } else {
      phoneInvalid = true;
    }
  }
  const imageUrl = typeof b.imageUrl === 'string' && /^https:\/\//.test(b.imageUrl) && b.imageUrl.length <= 500 ? b.imageUrl : null;
  const loc: LocationInput | null = {
    label,
    address,
    latitude: lat,
    longitude: lat !== null && lng !== null ? lng : null,
    phone,
    note: sanitizeText(b.note, 160),
    imageUrl,
    businessHours: safeHours(b.businessHours),
  };
  return { loc, phoneInvalid };
}

const LOCATION_COLUMNS = 'id, label, position, address, latitude, longitude, phone, note, image_url, business_hours';

export async function GET() {
  const sb = await getSellerClient();
  if (!sb) return apiError(401, 'unauthenticated', 'Sign in first.');
  const store = await getOwnStore<{ id: string; slug: string }>(sb, 'id, slug');
  if (!store) return apiError(404, 'no_store', 'Create your store first.');

  try {
    const { data, error } = await sb
      .from('store_locations')
      .select(LOCATION_COLUMNS)
      .eq('store_id', (store as { id: string }).id)
      .order('position', { ascending: true });
    if (error) throw error;
    return apiOk({ locations: data ?? [] });
  } catch (err) {
    return internalError('locations-get', err);
  }
}

export async function POST(req: NextRequest) {
  const sb = await getSellerClient();
  if (!sb) return apiError(401, 'unauthenticated', 'Sign in first.');
  const store = await getOwnStore<{ id: string; slug: string }>(sb, 'id, slug');
  if (!store) return apiError(404, 'no_store', 'Create your store first.');
  const storeId = (store as { id: string }).id;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError(400, 'invalid_json', 'Request body must be JSON.');
  }
  const { loc, phoneInvalid } = parseLocation(body as Record<string, unknown>);
  if (phoneInvalid) return apiError(422, 'invalid_phone', 'That phone number looks off — use a format like 08012345678 or +2348012345678.');
  if (!loc) return apiError(422, 'invalid_location', 'Give the branch a name.');

  try {
    const { count } = await sb
      .from('store_locations')
      .select('id', { count: 'exact', head: true })
      .eq('store_id', storeId);
    if ((count ?? 0) >= MAX_LOCATIONS) {
      return apiError(422, 'too_many', `Up to ${MAX_LOCATIONS} branches per store.`);
    }

    const { data: existing } = await sb
      .from('store_locations')
      .select('position')
      .eq('store_id', storeId)
      .order('position', { ascending: false })
      .limit(1);

    const { data, error } = await sb
      .from('store_locations')
      .insert({
        store_id: storeId,
        label: loc!.label,
        // Server-computed next position (max + 1) — never a duplicate after deletions.
        position: existing && existing.length > 0 ? Number(existing[0].position) + 1 : 1,
        address: loc!.address,
        latitude: loc!.latitude,
        longitude: loc!.longitude,
        phone: loc!.phone,
        note: loc!.note,
        image_url: loc!.imageUrl,
        business_hours: loc!.businessHours,
      })
      .select(LOCATION_COLUMNS)
      .single();
    if (error) throw error;
    revalidateStore((store as { slug: string }).slug);
    return apiOk({ location: data }, 201);
  } catch (err) {
    return internalError('locations-post', err);
  }
}

export async function PATCH(req: NextRequest) {
  const sb = await getSellerClient();
  if (!sb) return apiError(401, 'unauthenticated', 'Sign in first.');
  const store = await getOwnStore<{ id: string; slug: string }>(sb, 'id, slug');
  if (!store) return apiError(404, 'no_store', 'Create your store first.');
  const storeId = (store as { id: string }).id;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError(400, 'invalid_json', 'Request body must be JSON.');
  }
  const b = body as Record<string, unknown>;
  const id = sanitizeText(b.id, 40);
  if (!/^[0-9a-f-]{36}$/i.test(id)) return apiError(400, 'invalid_id', 'Invalid location id.');
  const { loc, phoneInvalid } = parseLocation(b);
  if (phoneInvalid) return apiError(422, 'invalid_phone', 'That phone number looks off — use a format like 08012345678 or +2348012345678.');
  if (!loc) return apiError(422, 'invalid_location', 'Give the branch a name.');
  try {
    const { error } = await sb
      .from('store_locations')
      .update({
        label: loc!.label,
        address: loc!.address,
        latitude: loc!.latitude,
        longitude: loc!.longitude,
        phone: loc!.phone,
        note: loc!.note,
        image_url: loc!.imageUrl,
        business_hours: loc!.businessHours,
      })
      .eq('id', id)
      .eq('store_id', storeId);
    if (error) throw error;
    revalidateStore((store as { slug: string }).slug);
    return apiOk({ updated: true });
  } catch (err) {
    return internalError('locations-patch', err);
  }
}

export async function DELETE(req: NextRequest) {
  const sb = await getSellerClient();
  if (!sb) return apiError(401, 'unauthenticated', 'Sign in first.');
  const store = await getOwnStore<{ id: string; slug: string }>(sb, 'id, slug');
  if (!store) return apiError(404, 'no_store', 'Create your store first.');

  const id = req.nextUrl.searchParams.get('id') ?? '';
  if (!/^[0-9a-f-]{36}$/i.test(id)) return apiError(400, 'invalid_id', 'Invalid location id.');

  try {
    const { error } = await sb
      .from('store_locations')
      .delete()
      .eq('id', id)
      .eq('store_id', (store as { id: string }).id);
    if (error) throw error;
    revalidateStore((store as { slug: string }).slug);
    return apiOk({ deleted: true });
  } catch (err) {
    return internalError('locations-delete', err);
  }
}
