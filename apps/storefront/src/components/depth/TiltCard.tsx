'use client';

// TiltCard (REDESIGN_V2 §3.3): pointer-follow tilt up to 6°, a soft light
// that follows the cursor, and a layered shadow that moves opposite the tilt.
// Keyboard focus inside gives the same lift. Touch: no pointer tilt.
// Reduced motion / Reduce effects: no tilt, no glow movement.

import * as React from 'react';
import { motion, useMotionTemplate, useMotionValue, useSpring, useTransform } from 'motion/react';
import { cn } from '@/lib/utils';
import { SPRING } from '@/lib/motion';
import { useCoarsePointer, useReduceEffects } from '@/lib/useReduceEffects';

export interface TiltCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Max tilt in degrees (V2 caps it at 6). */
  max?: number;
  /** Show the cursor-following light. */
  glow?: boolean;
  /** Lift on hover and focus. */
  lift?: boolean;
  as?: 'div' | 'article' | 'li';
}

export function TiltCard({
  max = 6,
  glow = true,
  lift = true,
  className,
  children,
  as = 'div',
  style,
  ...rest
}: TiltCardProps) {
  const reduce = useReduceEffects();
  const coarse = useCoarsePointer();
  const still = reduce || coarse;
  const limit = Math.min(max, 6);

  // -0.5..0.5 across the card
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const rotateX = useSpring(useTransform(py, [-0.5, 0.5], [limit, -limit]), SPRING.tilt);
  const rotateY = useSpring(useTransform(px, [-0.5, 0.5], [-limit, limit]), SPRING.tilt);
  const lx = useTransform(px, [-0.5, 0.5], [0, 100]);
  const ly = useTransform(py, [-0.5, 0.5], [0, 100]);
  const light = useMotionTemplate`radial-gradient(420px circle at ${lx}% ${ly}%, color-mix(in srgb, var(--primary) 16%, transparent), transparent 60%)`;
  // shadow drifts opposite to the tilt
  const sx = useTransform(px, [-0.5, 0.5], [10, -10]);
  const sy = useTransform(py, [-0.5, 0.5], [6, 22]);
  const shadow = useMotionTemplate`${sx}px ${sy}px 44px -18px rgba(0, 8, 30, 0.45)`;

  const [active, setActive] = React.useState(false);

  function onMove(e: React.PointerEvent<HTMLDivElement>) {
    if (still || e.pointerType !== 'mouse') return;
    const r = e.currentTarget.getBoundingClientRect();
    px.set((e.clientX - r.left) / r.width - 0.5);
    py.set((e.clientY - r.top) / r.height - 0.5);
  }
  function reset() {
    px.set(0);
    py.set(0);
    setActive(false);
  }

  const Comp = motion[as] as typeof motion.div;

  return (
    <Comp
      {...(rest as React.ComponentProps<typeof motion.div>)}
      className={cn('tilt-card', active && 'is-active', className)}
      style={{
        ...(style as object),
        transformPerspective: 900,
        rotateX: still ? 0 : rotateX,
        rotateY: still ? 0 : rotateY,
        boxShadow: still ? undefined : active ? shadow : undefined,
      }}
      animate={{ y: lift && active ? -4 : 0 }}
      transition={SPRING.soft}
      onPointerMove={onMove}
      onPointerEnter={() => setActive(true)}
      onPointerLeave={reset}
      onFocusCapture={() => setActive(true)}
      onBlurCapture={(e: React.FocusEvent<HTMLDivElement>) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) reset();
      }}
    >
      {glow && !still && (
        <motion.span
          aria-hidden
          className="tilt-card-light"
          style={{ background: light, opacity: active ? 1 : 0 }}
        />
      )}
      {children}
    </Comp>
  );
}
