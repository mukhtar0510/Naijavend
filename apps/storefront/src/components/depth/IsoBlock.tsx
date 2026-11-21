// IsoBlock + IsoScene (REDESIGN_V2 §3.3): isometric SVG blocks for
// low-rise buildings, stalls and parcels. Pure SVG, server-renderable, no JS.
// Colours come from tokens via CSS classes in styles/depth.css, so blocks
// follow the theme. Used by the /home diorama poster, /about and empty states.

import * as React from 'react';

const COS = Math.cos(Math.PI / 6); // 0.866
const SIN = 0.5;

/** Project an iso grid point (x right-down, y left-down, z up) to screen. */
function iso(x: number, y: number, z: number): [number, number] {
  return [(x - y) * COS, (x + y) * SIN - z];
}
const pts = (p: Array<[number, number]>) => p.map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`).join(' ');

export interface IsoBlockProps {
  /** Grid position of the block's back corner. */
  x?: number;
  y?: number;
  /** Footprint and height in grid units (1 unit ≈ 1 px before the scene's scale). */
  w: number;
  d: number;
  h: number;
  /** Visual role: building | stall | parcel. Maps to token colours. */
  kind?: 'building' | 'stall' | 'parcel';
  /** Rows of lit windows on the two visible walls. */
  windows?: number;
  /** Which windows are lit (gold); others stay dark. 0..1 */
  lit?: number;
}

export function IsoBlock({ x = 0, y = 0, w, d, h, kind = 'building', windows = 0, lit = 0.5 }: IsoBlockProps) {
  const top = [iso(x, y, h), iso(x + w, y, h), iso(x + w, y + d, h), iso(x, y + d, h)];
  const right = [iso(x + w, y, h), iso(x + w, y + d, h), iso(x + w, y + d, 0), iso(x + w, y, 0)];
  const left = [iso(x, y + d, h), iso(x + w, y + d, h), iso(x + w, y + d, 0), iso(x, y + d, 0)];

  const wins: React.ReactNode[] = [];
  if (windows > 0) {
    const rows = windows;
    const cols = Math.max(1, Math.round(w / 14));
    let n = 0;
    for (let r = 0; r < rows; r++) {
      const z = h - ((r + 1) * h) / (rows + 1);
      for (let c = 0; c < cols; c++) {
        const t = (c + 0.5) / cols;
        const [cx, cy] = iso(x + t * w, y + d, z);
        // deterministic "random" so server and client match
        const on = ((n * 9301 + 49297) % 233280) / 233280 < lit;
        n++;
        wins.push(
          <rect key={`l${r}-${c}`} x={cx - 2} y={cy - 3} width={4} height={5} className={on ? 'iso-win is-lit' : 'iso-win'} />,
        );
      }
    }
  }

  return (
    <g className={`iso-block iso-${kind}`}>
      <polygon className="iso-left" points={pts(left)} />
      <polygon className="iso-right" points={pts(right)} />
      <polygon className="iso-top" points={pts(top)} />
      {wins}
    </g>
  );
}

/**
 * IsoScene: an SVG frame for IsoBlocks. Children are drawn back to front in
 * the order given. `viewBox` is in projected screen units.
 */
export function IsoScene({
  viewBox = '-160 -120 320 220',
  className,
  title,
  children,
}: {
  viewBox?: string;
  className?: string;
  /** Leave empty for decoration (aria-hidden); set for a meaningful picture. */
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <svg
      viewBox={viewBox}
      className={className ? `iso-scene ${className}` : 'iso-scene'}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {children}
    </svg>
  );
}
