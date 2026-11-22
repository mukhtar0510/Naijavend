import type { Metadata } from 'next';
import Link from 'next/link';
import { Check, ArrowRight } from 'lucide-react';
import { PLANS } from '@/lib/plans';
import { BRAND } from '@idevtenancy/shared';

export const metadata: Metadata = {
  title: 'Pricing — one monthly plan, no commission',
  description:
    'Kwaravend plans in naira: a free tier with 25 listings, then Business at ₦3,000 and Emirates Plus at ₦8,000 per month. No commission on your sales and no card to start.',
};

export const dynamic = 'force-static';

const FAQ = [
  {
    q: 'Is there really a free plan?',
    a: 'Yes. The Free plan has no end date and no card: a store page, up to 25 listings, guest orders, pickup or delivery, and payment confirmation. It is the default for every new seller.',
  },
  {
    q: 'Do you take a cut of my sales?',
    a: 'No. Kwaravend takes 0% commission. Buyers pay you directly by bank transfer or on delivery, and you keep the full amount.',
  },
  {
    q: 'Can I pay for a plan today?',
    a: 'Yes. Open Plan in your dashboard, pick a plan and 1, 3, 6 or 12 months, and transfer to Kwaravend with the reference shown. Upload the receipt and your plan switches on once we confirm the money, usually the same day. Card payments are coming.',
  },
  {
    q: 'What happens if I outgrow a plan?',
    a: 'You keep your store, listings and orders. Limits are checked when you add a listing, a staff member or a location, and you can ask the team for a manual raise in the meantime.',
  },
  {
    q: 'Do I need a card to start?',
    a: 'No card, ever, for the Free plan. Paid plans are paid by bank transfer, so no card details are collected anywhere on the site.',
  },
];

export default function PricingPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-12 sm:px-7 lg:py-16">
      <div className="max-w-2xl">
        <span className="badge badge-gold">Pricing</span>
        <h1 className="mt-3 font-heading text-[30px] font-extrabold leading-tight text-foreground sm:text-[38px]">
          Start free. Pay only when your shop outgrows it.
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
          Every plan includes 0% commission and a public store page on {BRAND.name}. Prices are in naira, billed per
          month. Pay for a plan from your dashboard by bank transfer.
        </p>
      </div>

      <div className="mt-8 grid gap-3 md:grid-cols-3">
        {PLANS.map((plan) => {
          const free = plan.priceLabel === '₦0';
          return (
            <article
              key={plan.id}
              className={
                free
                  ? 'flex flex-col rounded-[16px] border border-border bg-card p-5'
                  : 'flex flex-col rounded-[16px] border border-dashed border-border-strong bg-[var(--elevated)] p-5'
              }
            >
              <h2 className="mb-1 font-heading text-[16px] font-bold text-foreground">{plan.name}</h2>
              <p className="mb-1 font-mono text-[26px] font-bold text-foreground">{plan.priceLabel}</p>
              <p className="mb-3 text-[12px] font-semibold text-muted-foreground">
                {free ? 'forever, no card' : 'per month'}
              </p>
              <p className="m-0 text-[13px] leading-relaxed text-muted-foreground">{plan.tagline}</p>
              <ul className="m-0 mt-3 grid list-none gap-2 p-0 text-[13px] text-muted-foreground">
                {plan.includes.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <Check size={14} className="mt-0.5 shrink-0" style={{ color: 'var(--success)' }} />
                    {item}
                  </li>
                ))}
              </ul>
              <div className="mt-auto pt-5">
                {free ? (
                  <Link href="/dashboard" className="btn btn-primary w-full justify-center">
                    Open your store
                  </Link>
                ) : (
                  <Link href="/dashboard/plan" className="btn btn-outline w-full justify-center">
                    Choose {plan.name}
                  </Link>
                )}
              </div>
            </article>
          );
        })}
      </div>

      <section className="mt-12 grid gap-2.5">
        <h2 className="m-0 font-heading text-[20px] font-bold text-foreground">Questions about pricing</h2>
        {FAQ.map((item) => (
          <details key={item.q} className="rounded-[14px] border border-border bg-card px-4 py-3.5">
            <summary className="cursor-pointer text-[14px] font-semibold text-foreground">{item.q}</summary>
            <p className="mb-0 mt-2 text-[13.5px] leading-relaxed text-muted-foreground">{item.a}</p>
          </details>
        ))}
      </section>

      <div className="mt-8 flex flex-wrap gap-2">
        <Link href="/faq" className="btn btn-outline">
          Full FAQ <ArrowRight size={16} />
        </Link>
        <Link href="/home" className="btn btn-ghost">
          Back to home
        </Link>
      </div>
    </main>
  );
}
