// Locked-feature state (REDESIGN T11): an icon, one sentence and a clear next
// step. While billing is off, paid plans say "Coming soon" (never a Buy
// button). Only shown when FEATURES.planGating is on.
import Link from 'next/link';
import { Lock } from 'lucide-react';

export function LockedFeature({ title, planName, children }: { title: string; planName: string; children?: React.ReactNode }) {
  return (
    <main style={{ maxWidth: 620 }}>
      <h1>{title}</h1>
      <div className="card" style={{ display: 'grid', gap: 10, padding: 20, justifyItems: 'start' }}>
        <span style={{ display: 'grid', placeItems: 'center', width: 44, height: 44, borderRadius: 14, background: 'var(--gold-tint)', color: 'var(--gold)' }} aria-hidden>
          <Lock size={20} />
        </span>
        <p style={{ margin: 0, fontSize: 15 }}>
          {children ?? `${title} is part of the ${planName} plan.`} Paid plans are coming soon, and nothing is charged today.
        </p>
        <Link href="/dashboard/plan" className="btn btn-outline">
          See plans
        </Link>
      </div>
    </main>
  );
}
