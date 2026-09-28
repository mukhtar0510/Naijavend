// Onboarding funnel analytics — fire-and-forget. Events POST to /api/funnel,
// which authenticates via the seller's httpOnly cookies (the browser never
// holds the JWT — localStorage is purged after the OAuth hand-off). Every call
// is best-effort: analytics must never break or slow down onboarding, so
// failures are swallowed silently.

type FunnelEvent = 'step_view' | 'step_complete' | 'chip_add' | 'preview_shown' | 'abandon';

// step_view fires once per step per page load (the stepper can re-render
// step 1 several times without a real revisit).
const seenStepViews = new Set<number>();

function send(event: FunnelEvent, step: number | null, label: string | null): void {
  try {
    fetch('/api/funnel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, step, label }),
      keepalive: true, // survive redirect/publish navigation
    }).catch(() => {
      // Analytics must never surface an error to the seller.
    });
  } catch {
    // ditto — e.g. fetch unavailable in a very old WebView
  }
}

export function trackStepView(step: number): void {
  if (seenStepViews.has(step)) return;
  seenStepViews.add(step);
  send('step_view', step, null);
}

export function trackStepComplete(step: number): void {
  send('step_complete', step, null);
}

export function trackChip(phrase: string): void {
  send('chip_add', 1, phrase);
}

export function trackPreviewShown(): void {
  send('preview_shown', 1, null);
}

/** Fired when the seller leaves onboarding without publishing. */
export function trackAbandon(step: number): void {
  send('abandon', step, null);
}
