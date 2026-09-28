// OAuth session hand-off: the /auth/callback page exchanges the OAuth code in
// the browser, then posts the resulting tokens here. We NEVER trust them
// blindly — the token is verified against Supabase before any cookie is set.
import { NextRequest } from 'next/server';
import { supabaseAuthClient, setSessionCookies, setCustomerSessionCookies } from '@/lib/auth';
import { apiError, apiOk, internalError } from '@/lib/api';
import { rateLimit, clientIp } from '@/lib/ratelimit';

export async function POST(req: NextRequest) {
  const rl = rateLimit(`oauth:${clientIp(req)}`, 10, 60_000);
  if (!rl.allowed) {
    return apiError(429, 'rate_limited', `Too many attempts. Try again in ${rl.retryAfterSeconds}s.`);
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return apiError(400, 'invalid_json', 'Request body must be JSON.');
  }

  const accessToken = typeof body.accessToken === 'string' ? body.accessToken : '';
  const refreshToken = typeof body.refreshToken === 'string' ? body.refreshToken : '';
  const role = body.role === 'seller' ? 'seller' : 'customer';

  if (!accessToken || !refreshToken) {
    return apiError(400, 'missing_tokens', 'Session tokens are required.');
  }

  try {
    const sb = supabaseAuthClient();
    const { data, error } = await sb.auth.getUser(accessToken);
    if (error || !data.user) {
      return apiError(401, 'invalid_token', 'The session could not be verified. Sign in again.');
    }

    // Server-side role correction: the client derives `role` from the ?next
    // redirect param, which the OAuth round-trip can mangle or drop — a seller
    // would then silently receive customer cookies and every dashboard save
    // (listings, locations, settings) would fail with "Sign in first".
    // A user who owns a store is always a seller, whatever the client claims.
    let effectiveRole = role;
    const { data: ownedStore } = await sb
      .from('stores')
      .select('id')
      .eq('owner_id', data.user.id)
      .limit(1);
    if (ownedStore && ownedStore.length > 0) {
      effectiveRole = 'seller';
    }

    if (effectiveRole === 'seller') {
      await setSessionCookies(accessToken, refreshToken);
    } else {
      await setCustomerSessionCookies(accessToken, refreshToken);
    }
    return apiOk({ ok: true, role: effectiveRole });
  } catch (err) {
    return internalError('oauth-session', err);
  }
}
