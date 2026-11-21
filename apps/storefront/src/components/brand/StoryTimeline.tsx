'use client';

// Scroll-drawn journey rail: the accent line fills as you read, each chapter
// fades up in sequence. Framer Motion useScroll + spring drives the fill.

import * as React from 'react';
import { motion, useScroll, useSpring } from 'motion/react';
import { Reveal } from '@/components/brand/Motion';
import { usePrefersReducedMotion } from '@/lib/usePrefersReducedMotion';

const CHAPTERS = [
  {
    kicker: 'Chapter 01',
    title: 'The DM problem',
    body: 'Nigerian businesses were already online — just scattered across WhatsApp statuses, Instagram captions and DMs. Buyers were asking the same questions twice, and sellers were retyping the same price list fifty times a day.',
  },
  {
    kicker: 'Chapter 02',
    title: 'A real storefront',
    body: 'So a store became a page, not a chat: a link with a catalogue, prices, hours and photos. Share it once — in a bio, a broadcast, a price tag — and it stays current.',
  },
  {
    kicker: 'Chapter 03',
    title: 'Orders, not guesswork',
    body: 'Products became orderable and services became bookable slots. Prices moved to the server, so what the buyer sees is what the seller receives — and double-bookings stopped being the seller’s job to prevent.',
  },
  {
    kicker: 'Chapter 04',
    title: 'The whole shop floor',
    body: 'A free POS for the counter, staff logins for cashiers, and branches for the second shop. The dashboard now runs the business; the storefront sells it.',
  },
  {
    kicker: 'Chapter 05',
    title: 'A marketplace that can be trusted',
    body: 'Live map pins, honest rankings, reviews tied to real purchases and a blue tick worth having. Discovery stopped being a favour and became a system.',
  },
];

export function StoryTimeline() {
  const ref = React.useRef<HTMLDivElement>(null);
  const reduce = usePrefersReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 78%', 'end 62%'] });
  const scaleY = useSpring(scrollYProgress, { stiffness: 90, damping: 26, mass: 0.4 });

  return (
    <div ref={ref} className="brand-timeline mx-auto max-w-[820px]">
      <div className="brand-timeline-rail" aria-hidden>
        {reduce ? (
          <div className="brand-timeline-fill" style={{ transform: 'scaleY(1)' }} />
        ) : (
          <motion.div className="brand-timeline-fill" style={{ scaleY }} />
        )}
      </div>

      <ol className="m-0 grid list-none gap-7 p-0">
        {CHAPTERS.map((chapter, index) => (
          <li key={chapter.kicker}>
            <Reveal delay={index * 0.04}>
              <div className="flex items-start gap-5">
                <span className="brand-timeline-dot mt-0.5" aria-hidden>
                  {String(index + 1).padStart(2, '0')}
                </span>
                <div className="min-w-0 pb-1">
                  <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    {chapter.kicker}
                  </span>
                  <h3 className="mb-1 mt-1 font-heading text-[19px] font-bold tracking-tight text-foreground">
                    {chapter.title}
                  </h3>
                  <p className="text-[14.5px] leading-relaxed text-muted-foreground" style={{ maxWidth: '58ch' }}>
                    {chapter.body}
                  </p>
                </div>
              </div>
            </Reveal>
          </li>
        ))}
      </ol>
    </div>
  );
}
