'use client';

// Mock upgrade CTA. T11 intentionally has no billing: clicking this stores a
// local flag and says so. Replace with a real request once paid plans exist.

import { useState } from 'react';

export function RequestAccess({ planName }: { planName: string }) {
  const [state, setState] = useState<'idle' | 'noted'>('idle');

  if (state === 'noted') {
    return (
      <p className="muted" style={{ fontSize: 13, margin: 0 }}>
        Noted on this device only — nothing was sent and nothing was charged. Billing is not
        connected in this preview.
      </p>
    );
  }

  return (
    <button type="button" className="btn btn-outline btn-sm" onClick={() => setState('noted')}>
      Request {planName}
    </button>
  );
}
