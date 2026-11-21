'use client';

// DepthStage + ParallaxStack (REDESIGN_V2 §3.3).
//
// DepthStage: a perspective container with six depth levels (z0 far → z5
// near) and one shared scroll source. <DepthLayer level={n}> places a child
// at that depth and moves it with scroll at a speed tied to the level.
// Scroll stays native; transform only. Reduce effects → everything static.

import * as React from 'react';
import { motion, useMotionValue, useScroll, useTransform, type MotionValue } from 'motion/react';
import { cn } from '@/lib/utils';
import { useReduceEffects } from '@/lib/useReduceEffects';

export type DepthLevel = 0 | 1 | 2 | 3 | 4 | 5;

/** translateZ (px) and parallax travel (px across the stage's scroll) per level. */
const LEVELS: Record<DepthLevel, { z: number; travel: number }> = {
  0: { z: -240, travel: -24 },
  1: { z: -160, travel: -40 },
  2: { z: -80, travel: -60 },
  3: { z: 0, travel: -80 },
  4: { z: 60, travel: -110 },
  5: { z: 120, travel: -150 },
};

const StageCtx = React.createContext<{ progress: MotionValue<number> | null; still: boolean }>({
  progress: null,
  still: true,
});

export function DepthStage({
  className,
  children,
  perspective = 1200,
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & { perspective?: number }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const still = useReduceEffects();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  return (
    <div
      ref={ref}
      className={cn('depth-stage', className)}
      style={{ perspective: still ? undefined : perspective, ...rest.style }}
      {...rest}
    >
      <StageCtx.Provider value={{ progress: scrollYProgress, still }}>{children}</StageCtx.Provider>
    </div>
  );
}

export function DepthLayer({
  level = 3,
  speed = 1,
  className,
  children,
  style,
}: {
  level?: DepthLevel;
  /** Multiplier on the level's parallax travel. 0 = no scroll movement. */
  speed?: number;
  className?: string;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}) {
  const { progress, still } = React.useContext(StageCtx);
  const { travel } = LEVELS[level];
  const outside = useMotionValue(0); // used when a layer sits outside a DepthStage
  const y = useTransform(progress ?? outside, [0, 1], [-travel * speed, travel * speed]);
  return (
    <motion.div
      aria-hidden
      className={cn('depth-layer', className)}
      data-depth={level}
      style={{ ...style, y: still || !progress ? 0 : y }}
    >
      {children}
    </motion.div>
  );
}

/**
 * ParallaxStack: a simple stack of layers, each moving at its own speed from
 * one scroll source. Pass `speeds` in the same order as the children
 * (0 = fixed, 1 = moves the full `travel`).
 */
export function ParallaxStack({
  speeds,
  travel = 120,
  className,
  children,
}: {
  speeds: number[];
  travel?: number;
  className?: string;
  children: React.ReactNode;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const still = useReduceEffects();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const items = React.Children.toArray(children);
  return (
    <div ref={ref} className={cn('parallax-stack', className)}>
      {items.map((child, i) => (
        <ParallaxItem key={i} progress={scrollYProgress} amount={(speeds[i] ?? 0) * travel} still={still}>
          {child}
        </ParallaxItem>
      ))}
    </div>
  );
}

function ParallaxItem({
  progress,
  amount,
  still,
  children,
}: {
  progress: MotionValue<number>;
  amount: number;
  still: boolean;
  children: React.ReactNode;
}) {
  const y = useTransform(progress, [0, 1], [amount / 2, -amount / 2]);
  return (
    <motion.div className="parallax-item" style={{ y: still ? 0 : y }}>
      {children}
    </motion.div>
  );
}
