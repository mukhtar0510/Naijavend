'use client';

// SitePreview: a browser frame showing a storefront (REDESIGN_V2 §5.1), with an
// optional tilted phone. Used by the "/" hero with labelled SAMPLE data and by
// the seller dashboard with the seller's REAL store. Styles: site-preview.css.
// Tilts with the pointer (TiltCard, ≤ 6°); the phone floats slowly while on
// screen. Reduced motion / Reduce effects: static.

import * as React from 'react';
import { motion } from 'motion/react';
import { BadgeCheck, MapPin, MessageCircle, Package } from 'lucide-react';
import { isOpenNow, type BusinessHours } from '@idevtenancy/shared';
import { TiltCard } from '@/components/depth/TiltCard';
import { SPRING } from '@/lib/motion';
import { useReduceEffects } from '@/lib/useReduceEffects';

export interface SitePreviewProduct {
  name: string;
  /** Already formatted, e.g. "₦18,500". */
  price: string;
  image?: string | null;
}

export interface SitePreviewProps {
  /** Gold pill on the frame, e.g. "Example storefront" or "Your store, live". */
  label: string;
  /** Address shown in the URL pill (no protocol). */
  url: string;
  name: string;
  logo?: string | null;
  verified?: boolean;
  area?: string | null;
  /** Open status is computed in the viewer's browser from these hours. */
  hours?: BusinessHours | null;
  /** Or force a value (sample data). */
  open?: boolean;
  promo?: { title: string; text?: string } | null;
  /** Seller accent for the promo banner; ignored when too light to read. */
  accent?: string | null;
  products: SitePreviewProduct[];
  /** Empty-state line when there are no products yet. */
  emptyProducts?: string;
  phone?: { inbound: string; outbound: string } | null;
  /** Accessible description of the whole picture. */
  description: string;
  /** Animate in on load (hero) or not (dashboard). */
  intro?: boolean;
}

const TONES = ['a', 'b', 'c'] as const;

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]!.toUpperCase())
      .join('') || 'K'
  );
}

/** Pick readable text for a hex accent; null when the accent isn't usable. */
function accentStyle(hex?: string | null): React.CSSProperties | undefined {
  const m = hex?.trim().match(/^#?([0-9a-f]{6})$/i);
  if (!m) return undefined;
  const n = parseInt(m[1]!, 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const L = 0.2126 * ch[0]! + 0.7152 * ch[1]! + 0.0722 * ch[2]!;
  const onWhite = 1.05 / (L + 0.05);
  const onDark = (L + 0.05) / 0.05;
  if (Math.max(onWhite, onDark) < 4.5) return undefined;
  return { background: `#${m[1]}`, color: onWhite >= onDark ? '#ffffff' : '#0a1226' };
}

export function SitePreview(props: SitePreviewProps) {
  const reduce = useReduceEffects();
  const [open, setOpen] = React.useState<boolean | null>(props.open ?? null);
  React.useEffect(() => {
    if (props.open !== undefined) return;
    setOpen(props.hours ? isOpenNow(props.hours, new Date()) : false);
  }, [props.open, props.hours]);

  const frame = (
    <TiltCard className="kvh-frame">
      <span className="kvh-example">{props.label}</span>
      <div className="kvh-chrome" aria-hidden>
        <i /> <i /> <i />
        <span className="kvh-url">{props.url}</span>
      </div>
      <div className="kvh-store" aria-hidden>
        <div className="kvh-store-head">
          {props.logo ? (
            // eslint-disable-next-line @next/next/no-img-element -- seller-supplied remote URL
            <img className="kvh-avatar" src={props.logo} alt="" />
          ) : (
            <span className="kvh-avatar">{initials(props.name)}</span>
          )}
          <div>
            <strong>
              <span className="kvh-name">{props.name}</span>
              {props.verified && <BadgeCheck size={15} className="kvh-tick" />}
            </strong>
            {props.area && (
              <span className="kvh-area">
                <MapPin size={12} /> {props.area}
              </span>
            )}
          </div>
          {open && (
            <span className="kvh-open">
              <i /> Open now
            </span>
          )}
        </div>
        {props.promo && (
          <div className="kvh-promo" style={accentStyle(props.accent)}>
            <strong>{props.promo.title}</strong>
            {props.promo.text && <span>{props.promo.text}</span>}
          </div>
        )}
        {props.products.length > 0 ? (
          <div className="kvh-products">
            {props.products.slice(0, 3).map((p, i) => (
              <div key={`${p.name}-${i}`} className="kvh-product">
                {p.image ? (
                  // eslint-disable-next-line @next/next/no-img-element -- seller-supplied remote URL
                  <img className="kvh-img" src={p.image} alt="" loading="lazy" />
                ) : (
                  <span className={`kvh-img kvh-img-${TONES[i % 3]}`} />
                )}
                <span className="kvh-pname">{p.name}</span>
                <span className="kvh-price">{p.price}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="kvh-noproducts">
            <Package size={18} />
            <span>{props.emptyProducts ?? 'No products yet'}</span>
          </div>
        )}
      </div>
    </TiltCard>
  );

  return (
    <div className={props.phone ? 'kvh-mock' : 'kvh-mock no-phone'} aria-label={props.description} role="img">
      {props.intro ? (
        <motion.div initial={{ opacity: 0, x: 40, y: 10 }} animate={{ opacity: 1, x: 0, y: 0 }} transition={{ ...SPRING.soft, delay: 0.25 }}>
          {frame}
        </motion.div>
      ) : (
        frame
      )}

      {props.phone && (
        <motion.div
          className="kvh-phone-wrap"
          initial={props.intro ? { opacity: 0, y: 40, rotate: 8 } : false}
          animate={{ opacity: 1, y: 0, rotate: 8 }}
          transition={{ ...SPRING.soft, delay: props.intro ? 0.45 : 0 }}
        >
          <motion.div
            className="kvh-phone"
            aria-hidden
            // The only infinite loop V2 allows: runs only while on screen.
            whileInView={reduce ? undefined : { y: [0, -5, 0] }}
            viewport={{ once: false, amount: 0.2 }}
            transition={reduce ? undefined : { duration: 6, repeat: Infinity, ease: 'easeInOut' }}
          >
            <div className="kvh-phone-head">
              {props.logo ? (
                // eslint-disable-next-line @next/next/no-img-element -- seller-supplied remote URL
                <img className="kvh-avatar sm" src={props.logo} alt="" />
              ) : (
                <span className="kvh-avatar sm">{initials(props.name)}</span>
              )}
              <strong>{props.name}</strong>
            </div>
            <div className="kvh-bubble in">{props.phone.inbound}</div>
            <div className="kvh-bubble out">{props.phone.outbound}</div>
            <span className="kvh-wa">
              <MessageCircle size={14} /> Order on WhatsApp
            </span>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}
