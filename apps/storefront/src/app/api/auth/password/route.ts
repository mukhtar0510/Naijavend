// Email + password auth for buyers and sellers (owner request, 21 Nov 2026).
// Supabase Auth does the work; Supabase sends the confirm / reset emails
// through Resend once the project's SMTP settings point at Resend
// (docs/EMAIL_AUTH.md). Passwords are never stored or logged by us.
//
// POST { action: 'signin' | 'signup' | 'reset', email, password?, role }
//   signin → sets the same httpOnly session cookies as Google sign-in
//   signup → creates the account; signs in at once if email confirmation is
//            off, otherwise asks the user to confirm from their inbox
//   reset  → sends a password-reset email (always answers the same way, so
//            the response never reveals whether an email has an account)
import { NextRequest } from 'next/server';
import { supabaseAuthClient, setSessionCookies, setCustomerSessionCookies } from '@/lib/auth';
import { apiError, apiOk, internalError } from '@/lib/api';
import { rateLimit, clientIp } from '@/lib/ratelimit';
import { siteUrl } from '@/lib/site';
import { sendWelcomeEmail } from '@/lib/email';

const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,24}$/;

export async function POST(req: NextRequest) {
  const rl = rateLimit(`pw-auth:${clientIp(req)}`, 10, 60_000);
  if (!rl.allowed) return apiError(429, 'rate_limited', `Too many attempts. Try again in ${rl.retryAfterSeconds}s.`);

  let b: Record<string, unknown>;
  try {
    b = (await req.json()) as Record<string, unknown>;
  } catch {
    return apiError(400, 'invalid_json', 'Request body must be JSON.');
  }
  const action = b.action;
  const email = typeof b.email === 'string' ? b.email.trim().toLowerCase().slice(0, 254) : '';
  const password = typeof b.password === 'string' ? b.password : '';
  const role = b.role === 'seller' ? 'seller' : 'customer';
  const next = role === 'seller' ? '/dashboard' : '/account';

  if (!EMAIL.test(email)) return apiError(422, 'invalid_email', 'Enter a valid email address.');

  const sb = supabaseAuthClient();
  try {
    if (action === 'reset') {
      // Same answer whether or not the account exists.
      await sb.auth.resetPasswordForEmail(email, { redirectTo: `${siteUrl()}/auth/reset?next=${encodeURIComponent(next)}` });
      return apiOk({ sent: true });
    }

    if (password.length < 8 || password.length > 72) {
      return apiError(422, 'invalid_password', 'Use a password of 8 to 72 characters.');
    }

    if (action === 'signup') {
      const { data, error } = await sb.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${siteUrl()}/auth/callback?next=${encodeURIComponent(next)}` },
      });
      if (error) {
        const msg = /already|registered/i.test(error.message)
          ? 'That email already has an account. Sign in instead, or reset your password.'
          : 'Could not create the account. Check the email and try again.';
        return apiError(422, 'signup_failed', msg);
      }
      void sendWelcomeEmail(email, role); // no-op until RESEND_API_KEY is set
      if (data.session) {
        const r = await startSession(sb, data.session.access_token, data.session.refresh_token, role);
        return apiOk({ signedIn: true, role: r, next: r === 'seller' ? '/dashboard' : '/account' });
      }
      return apiOk({ signedIn: false, needsConfirmation: true });
    }

    if (action === 'signin') {
      const { data, error } = await sb.auth.signInWithPassword({ email, password });
      if (error || !data.session) {
        const unconfirmed = error && /confirm/i.test(error.message);
        return apiError(
          401,
          unconfirmed ? 'email_not_confirmed' : 'bad_credentials',
          unconfirmed
            ? 'Confirm your email first: open the link we sent you, then sign in.'
            : 'Wrong email or password.',
        );
      }
      const r = await startSession(sb, data.session.access_token, data.session.refresh_token, role);
      return apiOk({ signedIn: true, role: r, next: r === 'seller' ? '/dashboard' : '/account' });
    }

    return apiError(400, 'invalid_action', 'Unknown action.');
  } catch (err) {
    return internalError('password-auth', err);
  }
}

/** Same role rule as Google sign-in: anyone who owns a store gets seller cookies. */
async function startSession(
  sb: ReturnType<typeof supabaseAuthClient>,
  access: string,
  refresh: string,
  role: 'seller' | 'customer',
): Promise<'seller' | 'customer'> {
  let effective = role;
  const { data: user } = await sb.auth.getUser(access);
  if (user.user) {
    const { data: owned } = await sb.from('stores').select('id').eq('owner_id', user.user.id).limit(1);
    if (owned && owned.length > 0) effective = 'seller';
  }
  if (effective === 'seller') await setSessionCookies(access, refresh);
  else await setCustomerSessionCookies(access, refresh);
  return effective;
}
