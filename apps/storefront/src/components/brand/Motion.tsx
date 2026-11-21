'use client';

// Shared motion primitives for the brand pages (About / FAQ).
// Framer Motion drives every effect: scroll reveals, staggered children,
// count-up stats, pointer-tilt cards, parallax and the reading-progress bar.
// Everything respects prefers-reduced-motion via usePrefersReducedMotion().

import * as React from 'react';
import { motion, useInView, useScroll, useSpring, useTransform } from 'motion/react';
import { cn } from '@/lib/utils';
import { usePrefersReducedMotion } from '@/lib/usePrefersReducedMotion';

const EASE = [0.22, 1, 0.36, 1] as const;

/* ------------------------------- Reveal ---------------------------------- */
export function Reveal({
  children,
  className,
  delay = 0,
  y = 26,
  once = true,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  y?: number;
  once?: boolean;
}) {
  const reduce = usePrefersReducedMotion();
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: reduce ? 0 : y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once, margin: '-70px' }}
      transition={{ duration: 0.65, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

/* ------------------------------- Stagger --------------------------------- */
export function Stagger({
  children,
  className,
  delay = 0,
  gap = 0.07,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  gap?: number;
}) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: '-60px' }}
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: gap, delayChildren: delay } },
      }}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className,
  y = 22,
}: {
  children: React.ReactNode;
  className?: string;
  y?: number;
}) {
  const reduce = usePrefersReducedMotion();
  return (
    <motion.div
      className={className}
      variants={{
        hidden: { opacity: 0, y: reduce ? 0 : y },
        show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: EASE } },
      }}
    >
      {children}
    </motion.div>
  );
}

/* ------------------------------- CountUp --------------------------------- */
export function CountUp({
  to,
  prefix = '',
  suffix = '',
  duration = 1.6,
  className,
}: {
  to: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
  className?: string;
}) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });
  const reduce = usePrefersReducedMotion();
  const [value, setValue] = React.useState(0);

  React.useEffect(() => {
    if (!inView) return;
    if (reduce) {
      setValue(to);
      return;
    }
    let raf = 0;
    const started = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - started) / (duration * 1000));
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(to * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, to, duration, reduce]);

  return (
    <span ref={ref} className={className}>
      {prefix}
      {value.toLocaleString('en-NG')}
      {suffix}
    </span>
  );
}

/* -------------------------------- Tilt ----------------------------------- */
export function Tilt({
  children,
  className,
  strength = 7,
}: {
  children: React.ReactNode;
  className?: string;
  strength?: number;
}) {
  const reduce = usePrefersReducedMotion();
  const rx = useSpring(0, { stiffness: 170, damping: 18, mass: 0.4 });
  const ry = useSpring(0, { stiffness: 170, damping: 18, mass: 0.4 });

  return (
    <motion.div
      className={className}
      style={{ rotateX: rx, rotateY: ry, transformPerspective: 900, transformStyle: 'preserve-3d' }}
      onPointerMove={(event: React.PointerEvent<HTMLDivElement>) => {
        if (reduce) return;
        if (event.pointerType === 'touch') return;
        const rect = event.currentTarget.getBoundingClientRect();
        const px = (event.clientX - rect.left) / rect.width - 0.5;
        const py = (event.clientY - rect.top) / rect.height - 0.5;
        ry.set(px * strength * 2);
        rx.set(-py * strength * 2);
      }}
      onPointerLeave={() => {
        rx.set(0);
        ry.set(0);
      }}
    >
      {children}
    </motion.div>
  );
}

/* ------------------------------- Parallax -------------------------------- */
export function Parallax({
  children,
  className,
  distance = 42,
}: {
  children: React.ReactNode;
  className?: string;
  distance?: number;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const reduce = usePrefersReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const raw = useTransform(scrollYProgress, [0, 1], [distance, -distance]);
  const y = useSpring(raw, { stiffness: 110, damping: 26, mass: 0.5 });

  return (
    <div ref={ref} className={className}>
      <motion.div style={reduce ? undefined : { y }}>{children}</motion.div>
    </div>
  );
}

/* ---------------------------- Scroll progress ---------------------------- */
export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 140, damping: 28, mass: 0.3 });
  return (
    <motion.div
      aria-hidden
      className="fixed inset-x-0 top-0 z-[60] h-[3px] origin-left bg-[linear-gradient(90deg,var(--blue),var(--brand-violet),var(--brand-pink))]"
      style={{ scaleX }}
    />
  );
}

/* -------------------------------- Marquee -------------------------------- */
export function Marquee({ items, className }: { items: React.ReactNode[]; className?: string }) {
  const loop = [...items, ...items];
  return (
    <div className={cn('brand-marquee', className)}>
      <div className="brand-marquee-track">
        {loop.map((item, index) => (
          <span key={index} className="brand-marquee-item" aria-hidden={index >= items.length}>
            {item}
            <span className="brand-marquee-dot" aria-hidden />
          </span>
        ))}
      </div>
    </div>
  );
}
