import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, MessageCircle, Sparkles } from 'lucide-react';

import { ScrollProgress, Marquee } from '@/components/brand/Motion';
import { FaqExplorer } from '@/components/brand/FaqExplorer';

export const metadata: Metadata = {
  title: 'Frequently asked questions',
  description:
    'How Naijavend works — buying, selling, the blue tick, the map, POS, staff accounts and your privacy. Searchable answers in plain English.',
};

const HIGHLIGHTS = [
  'Free to start',
  '0% commission',
  'Reviews from real orders',
  'Location stays in your browser',
  'POS, staff & branches included',
  'WhatsApp-first checkout',
];

export default function FaqPage() {
  return (
    <main className="brand">
      <ScrollProgress />

      {/* ------------------------------- Hero ------------------------------- */}
      <section className="brand-hero">
        <div className="brand-hero-grid" aria-hidden />
        <div className="relative mx-auto w-full max-w-6xl px-5 pb-12 pt-14 sm:px-7 lg:pb-14">
          <div className="flex flex-wrap items-center gap-3">
            <span className="brand-eyebrow">
              <span className="brand-eyebrow-dot" aria-hidden>
                <Sparkles size={11} />
              </span>
              Help centre
            </span>
            <Link
              href="/about"
              className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold no-underline"
            >
              New here? Start with the story <ArrowRight size={13} />
            </Link>
          </div>

          <h1 className="mb-3 mt-5 max-w-[20ch] font-heading text-[clamp(32px,5vw,52px)] font-extrabold leading-[1.0] tracking-[-0.045em] text-foreground">
            Questions, <span className="brand-grad">answered plainly.</span>
          </h1>
          <p className="m-0 max-w-[56ch] text-[15.5px] leading-relaxed text-muted-foreground">
            Buying, selling, ratings, the map and your data. Search it, filter it, or jump to the category you need —
            no support ticket required.
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            <Link href="/discover" className="brand-chip no-underline">
              <MessageCircle size={13} /> Chat a seller
            </Link>
            <Link href="/legal" className="brand-chip no-underline">
              Policies
            </Link>
            <Link href="/dashboard" className="brand-chip no-underline">
              Sell on Naijavend
            </Link>
          </div>
        </div>
        <div className="brand-hero-fade" aria-hidden />
      </section>

      <section className="border-b border-border bg-surface" aria-label="At a glance">
        <Marquee items={HIGHLIGHTS.map((item) => <span key={item}>{item}</span>)} />
      </section>

      {/* ------------------------------ Explorer ---------------------------- */}
      <section className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-7 lg:py-14">
        <FaqExplorer />
      </section>

      {/* -------------------------------- CTA ------------------------------- */}
      <section className="px-5 pb-20 sm:px-7">
        <div
          className="relative mx-auto w-full max-w-6xl overflow-hidden rounded-[26px] border border-border px-6 py-12 sm:px-10"
          style={{
            background:
              'radial-gradient(680px 320px at 12% -20%, rgba(29,78,216,0.18), transparent 62%), radial-gradient(520px 280px at 88% 130%, rgba(190,30,107,0.14), transparent 62%), var(--elevated)',
          }}
        >
          <div className="grid items-center gap-6 sm:grid-cols-[minmax(0,1fr)_auto]">
            <div>
              <h2 className="mb-2 font-heading text-[clamp(22px,3.2vw,30px)] font-extrabold leading-[1.1] tracking-[-0.035em] text-foreground">
                Still deciding? Read how it works.
              </h2>
              <p className="m-0 max-w-[52ch] text-[14.5px] leading-relaxed text-muted-foreground">
                The About page walks through the five layers of a storefront, the live components buyers use, and the
                rules behind the blue tick.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/about" className="btn btn-primary">
                Read the story <ArrowRight size={16} />
              </Link>
              <Link href="/dashboard" className="btn btn-outline">
                Open a store
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
