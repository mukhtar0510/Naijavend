'use client';

// "The stack" — Naijavend explained as five layers. A 2.5D isometric stack
// (Framer Motion) that responds to the list on the left and to pointer tilt,
// so the page has a real 3D object, not a flat illustration.

import * as React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Compass, Monitor, Package, Palette, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePrefersReducedMotion } from '@/lib/usePrefersReducedMotion';

const LAYERS = [
  {
    k: '01',
    title: 'Identity',
    sub: 'Logo · colours · typography',
    Icon: Palette,
    body: 'Your store gets its own look — uploaded logo, a brand accent colour and display font that flow through the masthead, buttons, receipts and QR cards. No template grid in sight.',
  },
  {
    k: '02',
    title: 'Catalogue',
    sub: 'Products · services · stock',
    Icon: Package,
    body: 'Products carry photos, variants, prices and stock counts; services carry duration and price. Sold-out items close themselves, and a listing draft can be written with AI assistance.',
  },
  {
    k: '03',
    title: 'Commerce',
    sub: 'Orders · bookings · discounts',
    Icon: Wallet,
    body: 'Buyers order products or book real appointment slots. Prices and promo codes are re-checked on the server, then the order lands in your dashboard and on WhatsApp.',
  },
  {
    k: '04',
    title: 'Operations',
    sub: 'POS · staff · branches',
    Icon: Monitor,
    body: 'Run the counter on the same stock with the free POS, hand cashiers their own staff logins, and split the business across branches — each with its own address, hours and phone.',
  },
  {
    k: '05',
    title: 'Reach',
    sub: 'Map · rankings · reviews · QR',
    Icon: Compass,
    body: 'Every store is a pin on the live map, a row on the rankings board and a QR code you can print. Reviews only come from real orders, which is what makes the blue tick mean something.',
  },
];

export function LayerStack() {
  const [active, setActive] = React.useState(0);
  const reduce = usePrefersReducedMotion();
  const layer = LAYERS[active];

  return (
    <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)] lg:gap-12">
      {/* Interactive index */}
      <div className="brand-layer-list">
        {LAYERS.map((item, index) => {
          const isActive = index === active;
          return (
            <button
              key={item.k}
              type="button"
              className={cn('brand-layer-btn', isActive && 'is-active')}
              aria-pressed={isActive}
              onClick={() => setActive(index)}
              onPointerEnter={() => setActive(index)}
            >
              <span className="brand-layer-k">{item.k}</span>
              <span style={{ display: 'grid', gap: 2 }}>
                <span className="flex items-center gap-2">
                  <item.Icon size={15} style={{ color: isActive ? 'var(--blue)' : 'var(--text-muted)' }} />
                  <span className="font-heading text-[15px] font-bold tracking-tight text-foreground">
                    {item.title}
                  </span>
                </span>
                <span className="text-[12.5px] text-muted-foreground">{item.sub}</span>
                <AnimatePresence initial={false}>
                  {isActive && (
                    <motion.span
                      key="body"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                      style={{ overflow: 'hidden', display: 'block' }}
                    >
                      <span
                        className="block pt-2 text-[13.5px] leading-relaxed text-muted-foreground"
                        style={{ maxWidth: '46ch' }}
                      >
                        {item.body}
                      </span>
                    </motion.span>
                  )}
                </AnimatePresence>
              </span>
            </button>
          );
        })}
      </div>

      {/* 2.5D isometric stack */}
      <div className="brand-iso-wrap order-first lg:order-none">
        <div
          className="brand-iso"
          role="img"
          aria-label={`Naijavend product stack — ${layer.title} layer highlighted`}
        >
          {LAYERS.map((item, index) => (
            <motion.button
              key={item.k}
              type="button"
              tabIndex={-1}
              aria-hidden
              data-k={item.k}
              className={cn('brand-slab', index === active && 'is-active')}
              style={{ zIndex: index }}
              animate={{
                z: reduce ? index * 18 : index * 24 + (index === active ? 10 : 0),
                opacity: index <= active + 2 ? 1 : 0.55,
              }}
              transition={{ type: 'spring', stiffness: 180, damping: 22 }}
              onClick={() => setActive(index)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
