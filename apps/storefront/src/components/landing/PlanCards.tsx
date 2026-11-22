'use client';

// Hoverable plan cards (REDESIGN R3 §4.6). Content comes from lib/plans.ts —
// never hard-coded. Hover and keyboard focus behave the same: the card lifts
// with a gentle tilt (max 6°) that follows the pointer, a soft glow follows
// the cursor, the feature list expands and the other cards dim. Touch: tap to
// expand, no tilt. Reduced motion: no tilt or glow, expansion still works.
// Paid plans link to /dashboard/plan, where the seller pays by bank transfer.

import { useRef, useState } from 'react';
import { BarChart3, Bike, Check, ChevronDown, Layers, MapPin, Store, Tag, Users, type LucideIcon } from 'lucide-react';
import { PLANS, LIMIT_LABELS, riderLabel, type PlanDef } from '@/lib/plans';
import { ButtonLink } from '@/components/ui/button';
import { Badge } from '@/components/ui/chip';

/** Icon + short tooltip per feature line (matched on keywords). */
function featureIcon(text: string): { icon: LucideIcon; tip: string } {
  const t = text.toLowerCase();
  if (t.includes('listing')) return { icon: Tag, tip: 'How many products or services can be live at once.' };
  if (t.includes('staff')) return { icon: Users, tip: 'Team members who can sign in with their own role.' };
  if (t.includes('location')) return { icon: MapPin, tip: 'Branches with their own address and opening hours.' };
  if (t.includes('template')) return { icon: Layers, tip: 'Ready-made looks for your store page.' };
  if (t.includes('rider') || t.includes('delivery')) return { icon: Bike, tip: 'Kwaravend rider delivery around Ilorin.' };
  if (t.includes('analytic') || t.includes('crm')) return { icon: BarChart3, tip: 'See who buys, what sells and what to restock.' };
  if (t.includes('page') || t.includes('store')) return { icon: Store, tip: 'Your own shareable store website.' };
  return { icon: Check, tip: '' };
}

function Card({ plan, active, dim, onActivate, onLeave }: { plan: PlanDef; active: boolean; dim: boolean; onActivate: () => void; onLeave: () => void }) {
  const ref = useRef<HTMLElement | null>(null);
  const finePointer = () => typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const reduced = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const onMove = (e: React.PointerEvent) => {
    const el = ref.current;
    if (!el || !finePointer() || reduced()) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    el.style.setProperty('--rx', `${((0.5 - y) * 12).toFixed(2)}deg`); // ±6°
    el.style.setProperty('--ry', `${((x - 0.5) * 12).toFixed(2)}deg`);
    el.style.setProperty('--gx', `${(x * 100).toFixed(1)}%`);
    el.style.setProperty('--gy', `${(y * 100).toFixed(1)}%`);
  };
  const reset = () => {
    const el = ref.current;
    if (!el) return;
    el.style.removeProperty('--rx');
    el.style.removeProperty('--ry');
    onLeave();
  };

  const featured = plan.id === 'plus';
  return (
    <article
      ref={ref}
      className={`plan-card${active ? ' is-active' : ''}${dim ? ' is-dim' : ''}${featured ? ' is-featured' : ''}`}
      tabIndex={0}
      aria-expanded={active}
      onPointerEnter={() => finePointer() && onActivate()}
      onPointerMove={onMove}
      onPointerLeave={() => finePointer() && reset()}
      onFocus={onActivate}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) reset();
      }}
      onClick={() => !finePointer() && (active ? onLeave() : onActivate())}
    >
      <div className="plan-glow" aria-hidden />
      <header>
        <h3>{plan.name}</h3>
        {plan.priceLabel === '₦0' ? <Badge tone="success">Free forever</Badge> : <Badge tone="success">Available now</Badge>}
      </header>
      <p className="plan-price">
        <span>{plan.priceLabel.replace('/mo', '')}</span>
        {plan.priceLabel.includes('/mo') ? <em>/month</em> : <em>forever, no card</em>}
      </p>
      <p className="plan-tagline">{plan.tagline}</p>
      <ul className="plan-features">
        {plan.includes.map((line, i) => {
          const { icon: I, tip } = featureIcon(line);
          return (
            <li key={line} style={{ ['--i' as string]: i }} title={tip || undefined}>
              <I size={15} aria-hidden />
              <span>{line}</span>
            </li>
          );
        })}
      </ul>
      <button type="button" className="plan-more" aria-label={active ? `Show less about ${plan.name}` : `Show all ${plan.name} features`} onClick={(e) => { e.stopPropagation(); if (active) { onLeave(); } else { onActivate(); } }}>
        {active ? 'Show less' : `All ${plan.includes.length} features`} <ChevronDown size={14} aria-hidden />
      </button>
      <div className="plan-cta">
        {plan.priceLabel === '₦0' ? (
          <ButtonLink href="/dashboard" variant="primary" fullWidth>
            Open your store, free
          </ButtonLink>
        ) : (
          <ButtonLink href="/dashboard/plan" variant="outline" fullWidth>
            Choose {plan.name}
          </ButtonLink>
        )}
      </div>
    </article>
  );
}

export function PlanCards() {
  const [active, setActive] = useState<string | null>(null);
  return (
    <div className="plan-wrap">
      <div className="plan-grid" onPointerLeave={() => setActive(null)}>
        {PLANS.map((p) => (
          <Card
            key={p.id}
            plan={p}
            active={active === p.id}
            dim={active != null && active !== p.id}
            onActivate={() => setActive(p.id)}
            onLeave={() => setActive((a) => (a === p.id ? null : a))}
          />
        ))}
      </div>
      <details className="plan-compare">
        <summary>Compare plans</summary>
        <div className="plan-table-wrap">
          <table className="plan-table">
            <thead>
              <tr>
                <th scope="col">Feature</th>
                {PLANS.map((p) => (
                  <th key={p.id} scope="col">
                    {p.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Price</th>
                {PLANS.map((p) => (
                  <td key={p.id}>{p.priceLabel}</td>
                ))}
              </tr>
              {(Object.keys(LIMIT_LABELS) as Array<keyof typeof LIMIT_LABELS>).map((k) => (
                <tr key={k}>
                  <th scope="row">{LIMIT_LABELS[k]}</th>
                  {PLANS.map((p) => (
                    <td key={p.id}>{p.limits[k] == null ? 'Unlimited' : p.limits[k]}</td>
                  ))}
                </tr>
              ))}
              <tr>
                <th scope="row">Rider delivery</th>
                {PLANS.map((p) => (
                  <td key={p.id}>
                    {riderLabel(p.limits.rider ?? null)}
                    {p.riderPriceLabel ? ` (${p.riderPriceLabel})` : ''}
                  </td>
                ))}
              </tr>
              <tr>
                <th scope="row">Can buy today</th>
                {PLANS.map((p) => (
                  <td key={p.id}>{p.priceLabel === '₦0' ? 'Yes, free' : 'Yes, by bank transfer'}</td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
