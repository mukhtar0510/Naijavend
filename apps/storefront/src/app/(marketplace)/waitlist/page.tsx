import type { Metadata } from 'next';
import { BRAND } from '@idevtenancy/shared';
import { WaitlistForm } from './WaitlistForm';

export const metadata: Metadata = {
  title: 'Join the waitlist',
  description: `${BRAND.name} is starting in Ilorin. Sellers in other cities can join the waitlist.`,
};

export default function WaitlistPage() {
  return (
    <main className="container" style={{ maxWidth: 560, paddingTop: 32, paddingBottom: 48 }}>
      <h1 style={{ fontSize: 'clamp(26px, 5vw, 34px)', marginBottom: 8 }}>Not in Ilorin yet?</h1>
      <p className="muted" style={{ fontSize: 16, marginTop: 0 }}>
        {BRAND.name} is starting in {BRAND.launchRegion.city}, {BRAND.launchRegion.state} State. If you sell somewhere
        else, join the list. We&apos;ll call you when we open in your city. Your store won&apos;t be listed until then.
      </p>
      <WaitlistForm />
    </main>
  );
}
