import Link from 'next/link';

interface Step {
  label: string;
  done: boolean;
  href: string;
  cta: string;
}

/**
 * T06 setup checklist. Every step is computed from real store state (listings,
 * logo, WhatsApp number, orders) — nothing is ticked optimistically. The card
 * disappears once everything is done.
 */
export function SetupChecklist({ steps }: { steps: Step[] }) {
  const done = steps.filter((s) => s.done).length;
  if (done === steps.length) return null;

  return (
    <section className="card" aria-labelledby="setup-checklist" style={{ marginTop: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <h2 id="setup-checklist" style={{ margin: 0, fontSize: 17 }}>
          Finish setting up
        </h2>
        <span className="muted" style={{ fontSize: 13 }}>
          {done} of {steps.length} done
        </span>
      </div>

      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={steps.length}
        aria-valuenow={done}
        aria-label="Setup progress"
        style={{ height: 8, borderRadius: 999, background: 'var(--line, #e6e6e6)', marginTop: 10, overflow: 'hidden' }}
      >
        <span
          style={{
            display: 'block',
            height: '100%',
            width: `${Math.round((done / steps.length) * 100)}%`,
            background: 'var(--naija, #0b7a3b)',
          }}
        />
      </div>

      <ol style={{ listStyle: 'none', margin: '12px 0 0', padding: 0, display: 'grid', gap: 8 }}>
        {steps.map((step) => (
          <li key={step.label} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14 }}>
            <span aria-hidden style={{ width: 18, textAlign: 'center' }}>
              {step.done ? '✅' : '○'}
            </span>
            <span style={{ flex: 1, textDecoration: step.done ? 'line-through' : undefined, opacity: step.done ? 0.6 : 1 }}>
              {step.label}
            </span>
            {!step.done && (
              <Link href={step.href} className="btn btn-outline btn-sm">
                {step.cta}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
