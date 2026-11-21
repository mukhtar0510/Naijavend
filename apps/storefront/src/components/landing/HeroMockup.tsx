'use client';

// "/" hero product mockup (REDESIGN_V2 §5.1). A browser frame showing an
// EXAMPLE storefront (sample data, labelled — honesty rule) and a tilted phone
// with a WhatsApp handoff. Follows the pointer with TiltCard (≤ 6°); the phone
// floats slowly. Touch: float only. Reduced motion / Reduce effects: static.
// No emojis, no real numbers.

import { motion } from 'motion/react';
import { BadgeCheck, MapPin, MessageCircle } from 'lucide-react';
import { TiltCard } from '@/components/depth/TiltCard';
import { SPRING } from '@/lib/motion';
import { useReduceEffects } from '@/lib/useReduceEffects';

const PRODUCTS = [
  { name: 'Red velvet, 8 inch', price: '₦18,500', tone: 'a' },
  { name: 'Chin chin, 1 kg tub', price: '₦4,200', tone: 'b' },
  { name: 'Cupcakes, box of 6', price: '₦7,800', tone: 'c' },
];

export function HeroMockup() {
  const reduce = useReduceEffects();
  return (
    <div className="kvh-mock" aria-label="Example storefront with sample data" role="img">
      <motion.div
        initial={{ opacity: 0, x: 40, y: 10 }}
        animate={{ opacity: 1, x: 0, y: 0 }}
        transition={{ ...SPRING.soft, delay: 0.25 }}
      >
        <TiltCard className="kvh-frame">
          <span className="kvh-example">Example storefront</span>
          <div className="kvh-chrome" aria-hidden>
            <i /> <i /> <i />
            <span className="kvh-url">kwaravend.ng/s/example-store</span>
          </div>
          <div className="kvh-store" aria-hidden>
            <div className="kvh-store-head">
              <span className="kvh-avatar">FC</span>
              <div>
                <strong>
                  Fate Cake Studio <BadgeCheck size={15} className="kvh-tick" />
                </strong>
                <span className="kvh-area">
                  <MapPin size={12} /> Fate, Ilorin
                </span>
              </div>
              <span className="kvh-open">
                <i /> Open now
              </span>
            </div>
            <div className="kvh-promo">
              <strong>Weekend cake orders are open</strong>
              <span>Order by Thursday for Saturday pickup or delivery.</span>
            </div>
            <div className="kvh-products">
              {PRODUCTS.map((p) => (
                <div key={p.name} className="kvh-product">
                  <span className={`kvh-img kvh-img-${p.tone}`} />
                  <span className="kvh-pname">{p.name}</span>
                  <span className="kvh-price">{p.price}</span>
                </div>
              ))}
            </div>
          </div>
        </TiltCard>
      </motion.div>

      <motion.div
        className="kvh-phone-wrap"
        initial={{ opacity: 0, y: 40, rotate: 8 }}
        animate={{ opacity: 1, y: 0, rotate: 8 }}
        transition={{ ...SPRING.soft, delay: 0.45 }}
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
            <span className="kvh-avatar sm">FC</span>
            <strong>Fate Cake Studio</strong>
          </div>
          <div className="kvh-bubble in">Hello, is the red velvet available for Saturday?</div>
          <div className="kvh-bubble out">Yes. Order on the store and pick delivery to Tanke.</div>
          <span className="kvh-wa">
            <MessageCircle size={14} /> Order on WhatsApp
          </span>
        </motion.div>
      </motion.div>
    </div>
  );
}
