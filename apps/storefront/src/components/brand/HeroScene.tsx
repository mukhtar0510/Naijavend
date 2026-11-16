'use client';

// Hero visual for the About page: a 2.5D composition — a real-looking browser
// storefront mockup (2D) with a floating phone (2.5D depth), live chips and a
// pointer-driven 3D tilt. Purely decorative: the same story is told in the copy.

import { motion, useMotionValue, useSpring } from 'framer-motion';
import { VerifiedTick } from '@/components/VerifiedTick';
import { usePrefersReducedMotion } from '@/lib/usePrefersReducedMotion';

export function HeroScene() {
  const reduce = usePrefersReducedMotion();
  const rotateX = useSpring(useMotionValue(0), { stiffness: 120, damping: 20, mass: 0.5 });
  const rotateY = useSpring(useMotionValue(0), { stiffness: 120, damping: 20, mass: 0.5 });

  return (
    <div
      className="brand-scene mx-auto w-full max-w-[560px]"
      onPointerMove={(event) => {
        if (reduce || event.pointerType === 'touch') return;
        const rect = event.currentTarget.getBoundingClientRect();
        const px = (event.clientX - rect.left) / rect.width - 0.5;
        const py = (event.clientY - rect.top) / rect.height - 0.5;
        rotateY.set(px * 10);
        rotateX.set(-py * 7);
      }}
      onPointerLeave={() => {
        rotateX.set(0);
        rotateY.set(0);
      }}
    >
      <motion.div
        aria-hidden
        className="brand-scene-inner"
        style={{ rotateX, rotateY, transformPerspective: 1400 }}
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
      >
        <span className="brand-demo-badge">Demo storefront</span>

        {/* Browser mockup — a Naijavend store site */}
        <div className="brand-browser">
          <div className="brand-browser-bar">
            <span className="brand-browser-dots" aria-hidden>
              <i /> <i /> <i />
            </span>
            <span className="brand-browser-url">
              <span style={{ color: 'var(--success)', fontWeight: 700 }}>●</span>
              naijavend.ng/s/amaka-glow-studio
            </span>
          </div>

          <div className="brand-mock-store">
            <div className="brand-mock-head">
              <span className="brand-mock-avatar">AG</span>
              <div style={{ display: 'grid', gap: 1, minWidth: 0 }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    fontFamily: 'var(--font-heading)',
                    fontWeight: 700,
                    fontSize: 13,
                    letterSpacing: '-0.01em',
                    color: 'var(--text)',
                  }}
                >
                  Amaka Glow Studio <VerifiedTick size={13} />
                </span>
                <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>
                  Beauty &amp; self-care · Lekki, Lagos
                </span>
              </div>
              <span
                style={{
                  marginLeft: 'auto',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '3px 8px',
                  borderRadius: 999,
                  background: 'var(--success-tint, #e8f6ee)',
                  color: 'var(--success)',
                  fontSize: 9.5,
                  fontWeight: 700,
                }}
              >
                <span style={{ width: 5, height: 5, borderRadius: 999, background: 'currentColor' }} />
                Open now
              </span>
            </div>

            <div className="brand-mock-banner">
              <span
                style={{
                  position: 'relative',
                  zIndex: 1,
                  display: 'inline-block',
                  padding: '2px 7px',
                  borderRadius: 999,
                  background: 'rgba(255,255,255,0.18)',
                  fontSize: 8.5,
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                }}
              >
                New this week
              </span>
              <p
                style={{
                  position: 'relative',
                  zIndex: 1,
                  margin: '6px 0 4px',
                  fontFamily: 'var(--font-heading)',
                  fontWeight: 800,
                  fontSize: 16,
                  lineHeight: 1.15,
                  letterSpacing: '-0.02em',
                  maxWidth: '18ch',
                }}
              >
                Glow-up bundles, 20% off
              </p>
              <span style={{ position: 'relative', zIndex: 1, fontSize: 9.5, opacity: 0.85 }}>
                Book a slot · pay on arrival
              </span>
            </div>

            <div className="brand-mock-grid">
              {[
                { cls: 't1', name: 'Shea body butter', price: '₦8,500' },
                { cls: 't2', name: 'Silk press', price: '₦15,000' },
                { cls: 't3', name: 'Glow set', price: '₦22,000' },
              ].map((tile) => (
                <div key={tile.name} className="brand-mock-tile">
                  <div className={`brand-mock-thumb ${tile.cls}`} />
                  <div className="brand-mock-tile-meta">
                    <b>{tile.name}</b>
                    <span>{tile.price}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Floating phone (2.5D layer) */}
        <div className="brand-phone" aria-hidden>
          <div className="brand-phone-screen">
            <div className="brand-phone-notch" />
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 6,
                  background: 'linear-gradient(135deg,#1d4ed8,#7c3aed)',
                  color: '#fff',
                  fontSize: 7.5,
                  fontWeight: 800,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                ZC
              </span>
              <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text)' }}>Zara&apos;s Cakes</span>
              <span style={{ marginLeft: 'auto', fontSize: 8, color: 'var(--text-muted)' }}>now</span>
            </div>
            <div
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 10,
                borderBottomLeftRadius: 3,
                padding: '6px 8px',
                fontSize: 8.5,
                color: 'var(--text)',
                lineHeight: 1.4,
              }}
            >
              Is the 6-inch cake available on Saturday?
            </div>
            <div
              style={{
                alignSelf: 'flex-end',
                background: 'var(--blue)',
                color: '#fff',
                borderRadius: 10,
                borderBottomRightRadius: 3,
                padding: '6px 8px',
                fontSize: 8.5,
                lineHeight: 1.4,
                maxWidth: '90%',
              }}
            >
              Yes! Order before Friday 6pm and we&apos;ll deliver. 🎂
            </div>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                background: '#25d366',
                color: '#06130a',
                borderRadius: 8,
                padding: '5px 7px',
                fontSize: 8.5,
                fontWeight: 700,
              }}
            >
              Order on WhatsApp
            </div>
          </div>
        </div>

      </motion.div>
    </div>
  );
}
