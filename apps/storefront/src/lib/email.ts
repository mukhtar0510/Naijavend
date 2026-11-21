// Transactional email through Resend's REST API (no SDK dependency).
// Auth emails (confirm address, reset password) are sent by Supabase via
// Resend SMTP — see docs/EMAIL_AUTH.md. This module is for Kwaravend's own
// messages (welcome, later order updates). Every call is a silent no-op until
// RESEND_API_KEY and EMAIL_FROM are set, so nothing breaks before the owner
// finishes the Resend setup.
import { BRAND } from '@idevtenancy/shared';
import { siteUrl } from './site';

interface SendArgs {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export async function sendEmail({ to, subject, html, text }: SendArgs): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM; // e.g. "Kwaravend <hello@yourdomain.com>" (a Resend-verified domain)
  if (!key || !from) return false;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [to], subject, html, text }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) console.warn('[email] Resend responded', res.status);
    return res.ok;
  } catch (err) {
    console.warn('[email] send failed:', (err as Error).message);
    return false;
  }
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Plain, honest welcome note. Text only, no emojis (they break across devices). */
export function sendWelcomeEmail(to: string, role: 'seller' | 'customer') {
  const site = siteUrl();
  const seller = role === 'seller';
  const subject = seller ? `Welcome to ${BRAND.name}: open your store` : `Welcome to ${BRAND.name}`;
  const line = seller
    ? `Your seller account is ready. Open your free store, add your first products and share your link: ${site}/dashboard`
    : `Your account is ready. Find stores near you in ${BRAND.launchRegion.city}: ${site}/map`;
  const text = `Hello,\n\n${line}\n\nIf you didn't create this account, you can ignore this email.\n\n${BRAND.name}`;
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#0a0f1a"><p>Hello,</p><p>${esc(line)}</p><p style="color:#4b5568;font-size:13px">If you didn't create this account, you can ignore this email.</p><p><strong>${esc(BRAND.name)}</strong></p></div>`;
  return sendEmail({ to, subject, html, text });
}
