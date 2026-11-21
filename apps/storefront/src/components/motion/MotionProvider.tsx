'use client';

// App-wide Motion config (REDESIGN_V2 §0.1). Under the OS reduced-motion
// setting or "Reduce effects", every Motion animation drops transform motion
// (opacity fades still run), so one switch covers the whole app.

import * as React from 'react';
import { MotionConfig } from 'motion/react';
import { useReduceEffects } from '@/lib/useReduceEffects';

export function MotionProvider({ children }: { children: React.ReactNode }) {
  const reduce = useReduceEffects();
  return <MotionConfig reducedMotion={reduce ? 'always' : 'user'}>{children}</MotionConfig>;
}
