'use client';

import { useState } from 'react';

// "Invite friends" card: shows the customer's referral link and how many
// friends have joined with it. Copy button with confirmation feedback.
export function ReferralCard({ link, invited }: { link: string; invited: number }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // Clipboard blocked (older browsers) — user can still select the text.
    }
  }

  return (
    <div className="card card-elevated referral-card">
      <h2 style={{ margin: '0 0 4px', fontSize: 18 }}>🎁 Invite friends</h2>
      <p className="muted" style={{ margin: '0 0 12px', fontSize: 13.5 }}>
        Share your link — when a friend signs up through it, they&apos;re counted here.
      </p>
      <div className="referral-row">
        <input readOnly value={link} aria-label="Your referral link" onFocus={(e) => e.currentTarget.select()} />
        <button type="button" className="btn btn-primary btn-sm" onClick={copy}>
          {copied ? 'Copied ✓' : 'Copy link'}
        </button>
      </div>
      <p style={{ margin: '10px 0 0', fontSize: 14 }}>
        <strong>{invited}</strong> friend{invited === 1 ? '' : 's'} joined with your link
        {invited > 0 ? ' 🎉' : ''} <span className="muted" style={{ fontSize: 12.5 }}>· links credit signups for 30 days</span>
      </p>
    </div>
  );
}
