# Email + password sign-in with Resend

Buyers and sellers can now sign in with **email and password** (sign up, sign in, forgot password) as
well as Google. Supabase Auth handles accounts and passwords. **Resend delivers the emails.**

## What's built

| Piece | Where |
| --- | --- |
| Sign in / create account / forgot password form | `components/auth/EmailPasswordForm.tsx`, on `/account/signin` and `/dashboard/signin` |
| Server route (rate-limited, sets the same httpOnly cookies as Google) | `app/api/auth/password/route.ts` |
| Confirm-email links | `/auth/callback` (accepts hash tokens as well as Google's code) |
| Reset-password page | `/auth/reset` |
| Kwaravend's own emails (welcome note) through Resend's API | `lib/email.ts` — silent no-op until the env vars below are set |

Passwords are 8–72 characters. Sign-in errors never reveal whether an email has an account. Anyone who owns a
store gets seller cookies, whichever page they signed in from.

## Your steps (owner)

1. **Create the Resend account** and **verify a sending domain** (Resend → Domains → add your domain, add the
   DNS records it shows). Emails from an unverified domain only reach your own address.
2. **Create an API key** in Resend (Settings → API Keys, "Sending access").
3. **Point Supabase's auth emails at Resend** (Supabase dashboard → Project Settings → Authentication → SMTP
   Settings → Enable custom SMTP):
   - Host `smtp.resend.com`, port `465`, username `resend`, password = your Resend API key
   - Sender email: an address on your verified domain (e.g. `hello@yourdomain.com`), sender name `Kwaravend`
4. **Allow the redirect pages** (Supabase → Authentication → URL Configuration → Redirect URLs): add
   `https://<your-site>/auth/callback` and `https://<your-site>/auth/reset` (and the `http://localhost:3000`
   versions for local testing).
5. **Choose confirmation** (Supabase → Authentication → Providers → Email): keep "Confirm email" **on**
   (recommended — people must click the link before signing in) or turn it off to sign people in straight away.
6. **Optional, for Kwaravend's own welcome email**: in Vercel (and `apps/storefront/.env.local`) set
   - `RESEND_API_KEY` = the same Resend API key
   - `EMAIL_FROM` = `Kwaravend <hello@yourdomain.com>`

   Redeploy after adding them. Without these, sign-in still works; only the welcome note is skipped.

## Testing once Resend is connected

1. On `/account/signin`, choose "Create account", enter an email you can read and a password.
2. Open the confirmation email (from your Resend sender) and click the link → you land signed in on `/account`.
3. Sign out, then "Forgot password?" → open the reset email → set a new password on `/auth/reset`.
4. Repeat on `/dashboard/signin` for a seller account.
