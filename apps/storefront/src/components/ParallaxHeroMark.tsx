'use client';

import { useEffect, useRef } from 'react';
import { NaijavendLogoMark } from '@/components/NaijavendLogo';

// Parallax 3D hero mark: the logo tilts toward the pointer with layered
// depth (shadow + glow counter-move for a genuine 3D feel). Falls back to
// the static float animation on touch devices with no fine pointer.

export function ParallaxHeroMark() {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Skip the pointer tracking on coarse-pointer (touch) devices.
    if (!window.matchMedia('(pointer: fine)').matches) return;

    let raf = 0;
    function onMove(e: PointerEvent) {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const rect = el!.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = Math.max(-1, Math.min(1, (e.clientX - cx) / (rect.width * 1.6)));
        const dy = Math.max(-1, Math.min(1, (e.clientY - cy) / (rect.height * 1.6)));
        el!.style.transform = `perspective(900px) rotateY(${dx * 14}deg) rotateX(${-dy * 12}deg) translateZ(14px)`;
        el!.style.setProperty('--px', `${dx * -18}px`);
        el!.style.setProperty('--py', `${dy * -12}px`);
      });
    }
    function onLeave() {
      el!.style.transform = '';
      el!.style.setProperty('--px', '0px');
      el!.style.setProperty('--py', '0px');
    }
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerleave', onLeave);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerleave', onLeave);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div ref={ref} className="nv-logo-hero parallax-hero" style={{ transition: 'transform 0.18s ease-out' }}>
      <NaijavendLogoMark size={96} />
    </div>
  );
}
