'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// 3D feature carousel ("wheel") for the About page: cards arranged on a
// rotating cylinder via CSS 3D transforms. Drag horizontally, use the arrow
// buttons, or let it auto-spin (pauses on hover/interaction).

export interface WheelItem {
  ico?: string;
  title?: string;
  text?: string;
  /** Rich card content — rendered instead of ico/title/text when provided. */
  node?: React.ReactNode;
  key?: string;
}

export function FeatureWheel({ items, accent = 'var(--blue)' }: { items: WheelItem[]; accent?: string }) {
  const [angle, setAngle] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [active, setActive] = useState(0);
  const dragX = useRef<number | null>(null);
  const dragStartAngle = useRef(0);
  const autoRef = useRef<number | null>(null);
  const pausedRef = useRef(false);

  const n = items.length;
  const step = 360 / n;
  const radius = n <= 6 ? 420 : n <= 8 ? 520 : 620;

  const normalise = useCallback((a: number) => ((a % 360) + 360) % 360, []);

  // Keep "active" (front-facing) card in sync while the wheel turns.
  useEffect(() => {
    const front = Math.round(normalise(-angle) / step) % n;
    setActive(((front % n) + n) % n);
  }, [angle, normalise, step, n]);

  // Gentle auto-rotation; pauses on hover/drag and resumes after a beat.
  useEffect(() => {
    if (pausedRef.current) return;
    autoRef.current = window.setInterval(() => {
      if (!pausedRef.current && !dragging) setAngle((a) => a - step / 3);
    }, 3500);
    return () => {
      if (autoRef.current) window.clearInterval(autoRef.current);
    };
  }, [dragging, step]);

  function onPointerDown(e: React.PointerEvent) {
    setDragging(true);
    pausedRef.current = true;
    dragX.current = e.clientX;
    dragStartAngle.current = angle;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (dragX.current == null) return;
    const dx = e.clientX - dragX.current;
    setAngle(dragStartAngle.current + dx * 0.25);
  }

  function onPointerUp() {
    dragX.current = null;
    setDragging(false);
    // Snap to the nearest card.
    setAngle((a) => Math.round(a / step) * step);
    window.setTimeout(() => {
      pausedRef.current = false;
    }, 4000);
  }

  function goTo(i: number) {
    pausedRef.current = true;
    setAngle(-i * step);
    window.setTimeout(() => {
      pausedRef.current = false;
    }, 5000);
  }

  return (
    <div
      className="wheel-wrap"
      role="region"
      aria-label="Feature carousel"
      onMouseEnter={() => {
        pausedRef.current = true;
      }}
      onMouseLeave={() => {
        pausedRef.current = false;
      }}
    >
      <div
        className="wheel-scene"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{ touchAction: 'pan-y', cursor: dragging ? 'grabbing' : 'grab' }}
      >
        <div
          className="wheel-ring"
          style={{
            transform: `translateZ(-${radius}px) rotateY(${angle}deg)`,
            ['--wheel-accent' as string]: accent,
          }}
        >
          {items.map((item, i) => {
            const isActive = i === active;
            const itemKey = item.key ?? item.title ?? `card-${i}`;
            return (
              <div
                key={itemKey}
                className={`wheel-card${isActive ? ' is-active' : ''}`}
                style={{ transform: `rotateY(${i * step}deg) translateZ(${radius}px)` }}
                aria-hidden={!isActive}
              >
                {item.node ?? (
                  <>
                    {item.ico && <div className="nv-feature-ico" aria-hidden>{item.ico}</div>}
                    {item.title && <h3>{item.title}</h3>}
                    {item.text && <p className="muted">{item.text}</p>}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="wheel-controls">
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={() => goTo((active - 1 + n) % n)}
          aria-label="Previous feature"
        >
          ← Prev
        </button>
        <div className="wheel-dots" role="tablist" aria-label="Features">
          {items.map((item, i) => (
            <button
              key={item.key ?? item.title ?? `dot-${i}`}
              type="button"
              role="tab"
              aria-selected={i === active}
              aria-label={item.title}
              className={`wheel-dot${i === active ? ' is-active' : ''}`}
              onClick={() => goTo(i)}
            />
          ))}
        </div>
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={() => goTo((active + 1) % n)}
          aria-label="Next feature"
        >
          Next →
        </button>
      </div>
    </div>
  );
}
