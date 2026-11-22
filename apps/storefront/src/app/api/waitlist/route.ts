// Seller waitlist for places outside Ilorin (BUILD.md T07). Write-only from
// the public; the owner sees counts by city in the admin Growth panel.
import { NextRequest } from 'next/server';
import { apiError, apiOk, internalError } from '@/lib/api';
import { rateLimit, clientIp } from '@/lib/ratelimit';
import { supabaseService } from '@/lib/supabase';
import { sanitizeText } from '@idevtenancy/shared';

export async function POST(req: NextRequest) {
  const rl = rateLimit(`waitlist:${clientIp(req)}`, 5, 60 * 60_000);
  if (!rl.allowed) return apiError(429, 'rate_limited', 'You already joined. Try again later if you need to.');
  let b: Record<string, unknown>;
  try {
    b = (await req.json()) as Record<string, unknown>;
  } catch {
    return apiError(400, 'invalid_json', 'Request body must be JSON.');
  }
  if (sanitizeText(b.website, 80)) return apiOk({ joined: true }); // honeypot: bots fill hidden fields
  const name = sanitizeText(b.name, 80);
  const city = sanitizeText(b.city, 60);
  const category = sanitizeText(b.category, 40);
  let phone = sanitizeText(b.phone, 20).replace(/[\s()-]/g, '');
  if (/^0\d{10}$/.test(phone)) phone = `+234${phone.slice(1)}`;
  if (name.length < 2) return apiError(422, 'invalid_name', 'Enter your name.');
  if (!/^\+?\d{10,15}$/.test(phone)) return apiError(422, 'invalid_phone', 'Enter a phone number, e.g. 08012345678.');
  if (city.length < 2) return apiError(422, 'invalid_city', 'Enter your city or town.');
  try {
    const { error } = await supabaseService()
      .from('seller_waitlist')
      .upsert({ name, phone, city, category }, { onConflict: 'phone' });
    if (error) throw error;
    return apiOk({ joined: true }, 201);
  } catch (err) {
    return internalError('waitlist', err);
  }
}
