// Inline "this part is on a paid plan" card, for sections inside a page that
// stays open on Free (analytics, discount codes, settings cards).
import Link from 'next/link';
import { Lock } from 'lucide-react';

export function PlanUpsell({ title, planName, children }: { title: string; planName: string; children?: React.ReactNode }) {
  return (
    <div className="card plan-upsell" style={{ display: 'flex', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap', marginTop: 16 }}>
      <span
        aria-hidden
        style={{ display: 'grid', placeItems: 'center', width: 40, height: 40, flex: '0 0 40px', borderRadius: 12, background: 'var(--gold-tint)', color: 'var(--gold)' }}
      >
        <Lock size={18} />
      </span>
      <div style={{ flex: '1 1 240px', minWidth: 0 }}>
        <strong style={{ display: 'block', fontSize: 15 }}>{title}</strong>
        <p className="muted" style={{ margin: '4px 0 0', fontSize: 13.5 }}>
          {children ?? `This is part of the ${planName} plan.`}
        </p>
      </div>
      <Link href="/dashboard/plan" className="btn btn-primary btn-sm" style={{ alignSelf: 'center' }}>
        Get {planName}
      </Link>
    </div>
  );
}
