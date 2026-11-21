'use client';

// /home buyer home (REDESIGN_V2 §6): area first, a diorama header with pins
// for open stores, a category chip row that filters in place, an "open now
// near you" snap carousel, a mini-map card, new real stores and area chips.
// Real data only, with honest empty states. Works the same for guests and
// signed-in buyers.

import * as React from 'react';
import Link from 'next/link';
import { motion } from 'motion/react';
import { ArrowRight, Map as MapIcon, Send, Store as StoreIcon } from 'lucide-react';
import { categoryLabel, isOpenNow } from '@idevtenancy/shared';
import { CategoryIcon } from '@/lib/categories';
import { ILORIN_AREAS } from '@/lib/ilorin';
import { SPRING, fadeUp, stagger, IN_VIEW } from '@/lib/motion';
import { AreaSelector, useArea } from '@/components/shell/AreaSelector';
import { HomeDiorama, type DioramaPin } from './HomeDiorama';
import { StoreCard } from './StoreCard';
import type { HomeStore } from './types';

const areaById = new Map(ILORIN_AREAS.map((a) => [a.id, a]));
function areaDistance(a: string | null, b: string | null): number {
  const p = a ? areaById.get(a) : undefined;
  const q = b ? areaById.get(b) : undefined;
  if (!p || !q) return 0;
  const dx = (p.lng - q.lng) * Math.cos((p.lat * Math.PI) / 180);
  const dy = p.lat - q.lat;
  return dx * dx + dy * dy;
}

export function HomeBrowser({
  stores,
  loadError,
}: {
  stores: HomeStore[];
  loadError: boolean;
}) {
  const [area, setArea] = useArea();
  const [category, setCategory] = React.useState<string | null>(null);
  const [pinArea, setPinArea] = React.useState<string | null>(null);
  // Open status is computed in the buyer's browser (Ilorin time), after mount
  // so server and client HTML match.
  const [now, setNow] = React.useState<Date | null>(null);
  React.useEffect(() => {
    setNow(new Date());
    const t = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(t);
  }, []);
  const isOpen = React.useCallback((s: HomeStore) => (now ? isOpenNow(s.hours, now) : false), [now]);

  const categories = React.useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of stores) counts.set(s.category, (counts.get(s.category) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([id, count]) => ({ id, count }));
  }, [stores]);

  const inCategory = React.useMemo(
    () => (category ? stores.filter((s) => s.category === category) : stores),
    [stores, category],
  );

  // Open first, then nearest area to the selected one, then newest.
  const nearby = React.useMemo(() => {
    const focus = pinArea ?? area;
    return [...inCategory]
      .filter((s) => !area || areaDistance(s.areaId, area) < 0.0009 || s.areaId === area)
      .sort(
        (a, b) =>
          Number(isOpen(b)) - Number(isOpen(a)) ||
          Number(b.areaId === focus) - Number(a.areaId === focus) ||
          areaDistance(a.areaId, focus) - areaDistance(b.areaId, focus) ||
          b.createdAt.localeCompare(a.createdAt),
      )
      .slice(0, 12);
  }, [inCategory, area, pinArea, isOpen]);
  const openCount = nearby.filter(isOpen).length;
  // Open stores in the chosen area (or all of Ilorin) for the live line.
  const openTotal = React.useMemo(
    () => stores.filter((s) => isOpen(s) && (!area || s.areaId === area || areaDistance(s.areaId, area) < 0.0009)).length,
    [stores, area, isOpen],
  );

  const pins: DioramaPin[] = React.useMemo(() => {
    const byArea = new Map<string, number>();
    for (const s of inCategory) if (s.areaId && isOpen(s)) byArea.set(s.areaId, (byArea.get(s.areaId) ?? 0) + 1);
    return [...byArea.entries()].map(([areaId, count]) => ({ areaId, count, label: areaById.get(areaId)?.label ?? areaId }));
  }, [inCategory, isOpen]);

  const fresh = React.useMemo(
    () => stores.filter((s) => !s.isExample).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6),
    [stores],
  );
  const areasWithStores = React.useMemo(() => new Set(stores.map((s) => s.areaId).filter(Boolean)), [stores]);
  const areaLabel = area ? areaById.get(area)?.label : null;

  const railRef = React.useRef<HTMLDivElement>(null);
  function pickPin(id: string | null) {
    setPinArea(id);
    railRef.current?.scrollTo({ left: 0, behavior: 'smooth' });
  }
  function pickArea(id: string | null) {
    setArea(id);
    setPinArea(null);
    document.getElementById('kvh-open')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <>
      {/* ============================== HEADER ============================== */}
      <section className="kvhome-hero" aria-labelledby="kvhome-title">
        <div className="container kvhome-hero-inner">
          <div className="kvhome-copy">
            <AreaSelector onChange={() => setPinArea(null)} />
            <h1 id="kvhome-title" className="kvhome-title">
              Open near you, <span className="kvhome-gold">right now</span>
            </h1>
            <p className="kvhome-sub">
              Ilorin stores with real prices in naira. Order, book or chat on WhatsApp.
            </p>
            {/* Owner, 21 Nov 2026: no second search bar here (the header has
                one). A live open-now line and two quick actions instead. */}
            <p className="kvhome-live" aria-live="polite">
              {now === null ? (
                <span className="kvhome-live-text">Checking who is open…</span>
              ) : openTotal > 0 ? (
                <>
                  <i className="kvhome-live-dot" aria-hidden />
                  <span className="kvhome-live-text">
                    <strong>{openTotal}</strong> {openTotal === 1 ? 'store is' : 'stores are'} open right now
                    {areaLabel ? ` around ${areaLabel}` : ' in Ilorin'}
                  </span>
                </>
              ) : (
                <span className="kvhome-live-text">Nothing is open right now. You can still order for later.</span>
              )}
            </p>
            <div className="kvhome-actions">
              <Link href={area ? `/map?area=${area}` : '/map'} className="btn btn-primary btn-lg">
                <MapIcon size={18} aria-hidden /> Explore the map
              </Link>
              <Link href="/discover" className="btn btn-outline btn-lg">
                Browse all stores <ArrowRight size={17} aria-hidden />
              </Link>
            </div>
          </div>
          <HomeDiorama
            pins={pins}
            selected={pinArea}
            onSelect={pickPin}
            emptyLabel={now ? 'Stores near you will appear here' : undefined}
          />
        </div>
      </section>

      {/* ============================ CHIP ROW ============================== */}
      <div className="kvhome-chips-wrap">
        <div className="container">
          <div className="kvhome-chips" role="toolbar" aria-label="Filter by category">
            <motion.button
              type="button"
              className={category === null ? 'chip is-active' : 'chip'}
              aria-pressed={category === null}
              onClick={() => setCategory(null)}
              whileTap={{ scale: 0.95 }}
            >
              All <span className="chip-count">{stores.length}</span>
            </motion.button>
            {categories.map((c) => (
              <motion.button
                key={c.id}
                type="button"
                className={category === c.id ? 'chip is-active' : 'chip'}
                aria-pressed={category === c.id}
                onClick={() => setCategory(category === c.id ? null : c.id)}
                whileTap={{ scale: 0.95 }}
                layout
                transition={SPRING.snappy}
              >
                <CategoryIcon category={c.id} size={15} /> {categoryLabel(c.id)}
                <span className="chip-count">{c.count}</span>
              </motion.button>
            ))}
          </div>
        </div>
      </div>

      <div className="container kvhome-body">
        {loadError && (
          <div className="kvhome-state" role="alert">
            <h2>Could not load stores</h2>
            <p>Check your connection and try again. Anything you saw before is still in your recently viewed list.</p>
            <Link href="/home" className="btn btn-outline">
              Try again
            </Link>
          </div>
        )}

        {/* ======================= OPEN NOW NEAR YOU ======================== */}
        <section id="kvh-open" className="kvhome-section" aria-labelledby="kvh-open-title">
          <div className="kvhome-head">
            <div>
              <h2 id="kvh-open-title">{openCount > 0 || !now ? 'Open now near you' : 'Stores near you'}</h2>
              <p>
                {now && nearby.length > 0 && openCount === 0
                  ? 'Nothing is open right now. These stores take orders for later.'
                  : areaLabel
                    ? `In and around ${areaLabel}.`
                    : 'Open stores first, then the closest ones.'}
              </p>
            </div>
            <Link href="/discover" className="kvhome-link">
              See all <ArrowRight size={15} aria-hidden />
            </Link>
          </div>

          {!now && stores.length > 0 ? (
            <div className="kvhome-rail" aria-hidden>
              {[0, 1, 2].map((i) => (
                <div key={i} className="kvs-card kvs-skeleton" />
              ))}
            </div>
          ) : nearby.length > 0 ? (
            <div className="kvhome-rail" ref={railRef} tabIndex={0} aria-label="Stores, scroll sideways">
              {nearby.map((s) => (
                <StoreCard key={s.id} store={s} open={isOpen(s)} highlighted={!!pinArea && s.areaId === pinArea} />
              ))}
            </div>
          ) : !loadError ? (
            <div className="kvhome-state">
              <span className="kvhome-state-ico" aria-hidden>
                <StoreIcon size={22} />
              </span>
              <h3>{areaLabel ? `No stores in ${areaLabel} yet` : 'No stores here yet'}</h3>
              <p>Kwaravend is just starting in Ilorin. Try another area, or tell a seller you know.</p>
              <div className="kvhome-state-actions">
                {(area || category) && (
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => {
                      setCategory(null);
                      pickArea(null);
                    }}
                  >
                    Try another area
                  </button>
                )}
                <InviteSeller />
              </div>
            </div>
          ) : null}
        </section>

        {/* =========================== MINI MAP ============================= */}
        <section className="kvhome-section" aria-labelledby="kvh-map-title">
          <Link href={area ? `/map?area=${area}` : '/map'} className="kvmini">
            <div className="kvmini-copy">
              <span className="badge badge-primary">
                <MapIcon size={13} aria-hidden /> Ilorin map
              </span>
              <h2 id="kvh-map-title">See who is around you</h2>
              <p>Stores on a map of Ilorin, with directions and WhatsApp in one tap. Your location stays on your phone.</p>
              <span className="btn btn-primary">
                Explore the map <ArrowRight size={16} aria-hidden />
              </span>
            </div>
            <div className="kvmini-map" aria-hidden>
              <div className="kvmini-plane">
                <span className="kvmini-road r1" />
                <span className="kvmini-road r2" />
                <span className="kvmini-road r3" />
                {ILORIN_AREAS.filter((a) => areasWithStores.has(a.id))
                  .slice(0, 8)
                  .map((a) => {
                    const x = ((a.lng - 4.525) / 0.1) * 100;
                    const y = ((8.52 - a.lat) / 0.07) * 100;
                    return (
                      <span
                        key={a.id}
                        className={a.id === area ? 'kvmini-pin is-active' : 'kvmini-pin'}
                        style={{ left: `${Math.min(92, Math.max(6, x))}%`, top: `${Math.min(90, Math.max(8, y))}%` }}
                      />
                    );
                  })}
              </div>
            </div>
          </Link>
        </section>

        {/* ========================= NEW ON KWARAVEND ======================= */}
        <section className="kvhome-section" aria-labelledby="kvh-new-title">
          <div className="kvhome-head">
            <div>
              <h2 id="kvh-new-title">New on Kwaravend</h2>
              <p>The newest Ilorin stores to open.</p>
            </div>
          </div>
          {fresh.length > 0 ? (
            <motion.div className="kvhome-grid" variants={stagger(0.05)} initial="hidden" whileInView="show" viewport={IN_VIEW}>
              {fresh.map((s) => (
                <motion.div key={s.id} variants={fadeUp}>
                  <StoreCard store={s} open={isOpen(s)} />
                </motion.div>
              ))}
            </motion.div>
          ) : (
            <div className="kvhome-invite">
              <div>
                <h3>Know a seller in Ilorin?</h3>
                <p>Send them the link. Opening a store is free, with no commission on sales.</p>
              </div>
              <InviteSeller />
            </div>
          )}
        </section>

        {/* ========================= AREAS TO BROWSE ======================== */}
        <section className="kvhome-section" aria-labelledby="kvh-areas-title">
          <div className="kvhome-head">
            <div>
              <h2 id="kvh-areas-title">Areas to browse</h2>
              <p>Pick a part of Ilorin to see its stores first.</p>
            </div>
          </div>
          {/* Owner, 21 Nov 2026: areas in a simple dropdown, not a wall of chips. */}
          <AreaSelector
            label="Browse an Ilorin area"
            onChange={() => {
              setPinArea(null);
              document.getElementById('kvh-open')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
          />
        </section>
      </div>
    </>
  );
}

/** Shares the "sell on Kwaravend" link (Web Share, else copy, else open). */
function InviteSeller() {
  const [copied, setCopied] = React.useState(false);
  async function share() {
    const url = `${window.location.origin}/dashboard`;
    const text = 'Open a free store on Kwaravend and take orders from customers in Ilorin.';
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Kwaravend', text, url });
        return;
      }
      await navigator.clipboard.writeText(`${text} ${url}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      /* dismissed or blocked: nothing to do */
    }
  }
  return (
    <button type="button" className="btn btn-primary" onClick={share}>
      <Send size={16} aria-hidden /> {copied ? 'Link copied' : 'Invite a seller'}
    </button>
  );
}
