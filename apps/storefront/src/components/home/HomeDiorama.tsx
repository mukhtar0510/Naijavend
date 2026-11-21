'use client';

// /home diorama header (REDESIGN_V2 §6.3). An isometric SVG of low-rise
// Ilorin-style blocks laid out roughly like the seeded areas, with one pin per
// area that has open stores right now (area level only, never addresses).
// Tap or hover a pin to highlight that area's stores below.
//
// This is the "lite" diorama for every tier. The WebGL version (standard and
// full tiers) waits for the owner's decision on three.js and 3D models; the
// SVG keeps the 150 KB budget with room to spare and needs no extra chunk.

import * as React from 'react';
import { AnimatePresence, motion, useScroll, useTransform } from 'motion/react';
import { ILORIN_AREAS } from '@/lib/ilorin';
import { IsoBlock, IsoScene } from '@/components/depth/IsoBlock';
import { SPRING } from '@/lib/motion';
import { useReduceEffects } from '@/lib/useReduceEffects';

const COS = Math.cos(Math.PI / 6);
const VB = { x: -190, y: -80, w: 380, h: 300 };
const lats = ILORIN_AREAS.map((a) => a.lat);
const lngs = ILORIN_AREAS.map((a) => a.lng);
const [minLat, maxLat, minLng, maxLng] = [Math.min(...lats), Math.max(...lats), Math.min(...lngs), Math.max(...lngs)];

/** Area → iso grid position (0..200), north toward the back. */
function grid(lat: number, lng: number) {
  return {
    gx: 20 + ((lng - minLng) / (maxLng - minLng)) * 160,
    gy: 20 + ((maxLat - lat) / (maxLat - minLat)) * 160,
  };
}
function project(gx: number, gy: number, z: number) {
  return { sx: (gx - gy) * COS, sy: (gx + gy) * 0.5 - z };
}

// Deterministic heights so server and client draw the same scene.
const BLOCKS = ILORIN_AREAS.map((a, i) => {
  const { gx, gy } = grid(a.lat, a.lng);
  const h = 14 + ((i * 37) % 26);
  return { id: a.id, gx: gx - 7, gy: gy - 7, h, kind: (i % 5 === 2 ? 'stall' : 'building') as 'stall' | 'building' };
}).sort((p, q) => p.gx + p.gy - (q.gx + q.gy));

export interface DioramaPin {
  areaId: string;
  label: string;
  count: number;
}

export function HomeDiorama({
  pins,
  selected,
  onSelect,
  emptyLabel,
}: {
  pins: DioramaPin[];
  selected: string | null;
  onSelect: (areaId: string | null) => void;
  emptyLabel?: string;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const reduce = useReduceEffects();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], [0, 40]);

  return (
    <div ref={ref} className="kvd">
      <motion.div className="kvd-stage" style={{ y: reduce ? 0 : y }}>
        <IsoScene viewBox={`${VB.x} ${VB.y} ${VB.w} ${VB.h}`} className="kvd-svg">
          {/* ground slab */}
          <IsoBlock x={0} y={0} w={200} d={200} h={4} kind="building" />
          {BLOCKS.map((b) => (
            <IsoBlock key={b.id} x={b.gx} y={b.gy} w={14} d={14} h={b.h} kind={b.kind} windows={b.h > 24 ? 2 : 1} lit={0.55} />
          ))}
        </IsoScene>

        <AnimatePresence>
          {pins.map((p, i) => {
            const area = ILORIN_AREAS.find((a) => a.id === p.areaId);
            if (!area) return null;
            const { gx, gy } = grid(area.lat, area.lng);
            const block = BLOCKS.find((b) => b.id === p.areaId);
            const { sx, sy } = project(gx, gy, (block?.h ?? 20) + 8);
            const left = ((sx - VB.x) / VB.w) * 100;
            const top = ((sy - VB.y) / VB.h) * 100;
            const active = selected === p.areaId;
            return (
              <motion.button
                key={p.areaId}
                type="button"
                className={active ? 'kvd-pin is-active' : 'kvd-pin'}
                style={{ left: `${left}%`, top: `${top}%` }}
                initial={{ scale: 0, opacity: 0, y: 8 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ ...SPRING.snappy, delay: 0.3 + i * 0.06 }}
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.95 }}
                aria-pressed={active}
                aria-label={`${p.count} open ${p.count === 1 ? 'store' : 'stores'} in ${p.label}`}
                onClick={() => onSelect(active ? null : p.areaId)}
              >
                <span className="kvd-pin-dot">{p.count}</span>
                <span className="kvd-pin-label">{p.label}</span>
              </motion.button>
            );
          })}
        </AnimatePresence>

        {pins.length === 0 && emptyLabel && <p className="kvd-empty">{emptyLabel}</p>}
      </motion.div>
    </div>
  );
}
