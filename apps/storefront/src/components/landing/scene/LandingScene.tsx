'use client';

// Layered landing scene (REDESIGN R3 §4). Decoration only: aria-hidden, and
// every real word on the page lives in normal HTML on top of it.
//
// Engine rules: one requestAnimationFrame loop reads scroll and writes
// transform/opacity only; it stops when the hero is off-screen or the tab is
// hidden. Quality tier is chosen automatically (lite until a short FPS probe
// passes), can be forced with ?layers=lite|standard|full, and "Reduce effects"
// (html.reduce-effects) always forces lite with no motion.

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, MessageCircle, PackageCheck, Store, Truck } from 'lucide-react';
import { layersForTier, type SceneLayer, type Tier } from './layers';

const STORAGE_KEY = 'nv-reduce-effects';

function staticTier(): Tier | null {
  if (typeof window === 'undefined') return 'lite';
  const q = new URLSearchParams(window.location.search).get('layers');
  if (q === 'lite' || q === 'standard' || q === 'full') return q;
  if (document.documentElement.classList.contains('reduce-effects')) return 'lite';
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return 'lite';
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean; effectiveType?: string } };
  if (nav.connection?.saveData) return 'lite';
  if (nav.connection?.effectiveType && /(^|-)2g|3g/.test(nav.connection.effectiveType)) return 'lite';
  if ((nav.deviceMemory ?? 4) < 4 || (nav.hardwareConcurrency ?? 2) < 4) return 'lite';
  return null; // needs the FPS probe
}

/** ~1 second rAF probe: average FPS decides standard vs full. */
function probeFps(): Promise<number> {
  return new Promise((resolve) => {
    let frames = 0;
    const start = performance.now();
    const tick = (t: number) => {
      frames++;
      if (t - start < 1000) requestAnimationFrame(tick);
      else resolve((frames * 1000) / (t - start));
    };
    requestAnimationFrame(tick);
  });
}

export function useSceneTier(): Tier {
  const [tier, setTier] = useState<Tier>('lite');
  useEffect(() => {
    try {
      if (window.localStorage.getItem(STORAGE_KEY) === '1') document.documentElement.classList.add('reduce-effects');
    } catch {
      /* private mode */
    }
    const fixed = staticTier();
    if (fixed) {
      setTier(fixed);
      return;
    }
    let cancelled = false;
    // Probe after first paint and idle, so it never competes with LCP.
    const run = () =>
      probeFps().then((fps) => {
        if (cancelled) return;
        const nav = navigator as Navigator & { deviceMemory?: number };
        const strong = (nav.hardwareConcurrency ?? 4) >= 8 && (nav.deviceMemory ?? 8) >= 8;
        setTier(fps >= 50 && strong ? 'full' : fps >= 40 ? 'standard' : 'lite');
      });
    const idle = (window as Window & { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback;
    const h = idle ? idle(run) : window.setTimeout(run, 600);
    const onReduce = () => setTier('lite');
    window.addEventListener('nv-reduce-effects', onReduce);
    return () => {
      cancelled = true;
      if (!idle) window.clearTimeout(h);
      window.removeEventListener('nv-reduce-effects', onReduce);
    };
  }, []);
  return tier;
}

// ------------------------------------------------------------------ art
function Art({ l }: { l: SceneLayer }) {
  const v = l.variant ?? 0;
  switch (l.kind) {
    case 'sky':
      return <div className="sc-fill sc-sky" />;
    case 'sun':
      return <div className="sc-sun" />;
    case 'horizon':
      return <div className="sc-fill sc-horizon" />;
    case 'cloud':
      return (
        <svg viewBox="0 0 160 50" className="sc-svg">
          <path className="sc-cloud" d="M20 40c-11 0-18-8-15-16 3-7 11-9 18-6 3-10 15-16 27-12 9-9 26-8 33 4 13-5 28 2 30 14 10 0 17 6 16 16z" />
        </svg>
      );
    case 'haze':
      return <div className="sc-fill sc-haze" />;
    case 'pattern':
      return <div className="sc-fill sc-pattern" />;
    case 'grain':
      return <div className="sc-fill sc-grain" />;
    case 'vignette':
      return <div className="sc-fill sc-vignette" />;
    case 'stars':
      return <div className="sc-fill sc-stars" />;
    case 'building': {
      const roof = v % 3;
      return (
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="sc-svg">
          <rect className="sc-bld" x="0" y={roof === 0 ? 18 : 10} width="100" height="90" />
          {roof === 1 && <polygon className="sc-bld-roof" points="-4,12 50,0 104,12" />}
          {roof === 2 && <rect className="sc-bld-roof" x="10" y="2" width="30" height="10" />}
          {[0, 1, 2].map((r) =>
            [0, 1, 2].map((c) => <rect key={`${r}${c}`} className="sc-win" x={12 + c * 28} y={30 + r * 22} width="14" height="10" />),
          )}
        </svg>
      );
    }
    case 'tree':
      return (
        <svg viewBox="0 0 70 80" className="sc-svg">
          <rect className="sc-trunk" x="31" y="44" width="8" height="36" />
          <circle className="sc-leafy" cx="35" cy="30" r="26" />
          <circle className="sc-leafy sc-leafy-2" cx="20" cy="40" r="16" />
          <circle className="sc-leafy sc-leafy-2" cx="50" cy="40" r="16" />
        </svg>
      );
    case 'hill':
      return (
        <svg viewBox="0 0 620 160" preserveAspectRatio="none" className="sc-svg">
          <path className={`sc-hill sc-hill-${v}`} d="M0 160 C120 40 240 20 330 70 C420 120 520 50 620 90 L620 160 Z" />
        </svg>
      );
    case 'dome':
      return (
        <svg viewBox="0 0 90 110" className="sc-svg">
          {v === 1 ? (
            <>
              <rect className="sc-bld" x="20" y="10" width="50" height="34" rx="6" />
              <rect className="sc-trunk" x="26" y="44" width="4" height="66" />
              <rect className="sc-trunk" x="60" y="44" width="4" height="66" />
            </>
          ) : (
            <>
              <path className="sc-bld-roof" d="M10 60 Q45 0 80 60 Z" />
              <rect className="sc-bld" x="10" y="58" width="70" height="52" />
            </>
          )}
        </svg>
      );
    case 'powerline':
      return (
        <svg viewBox="0 0 1000 40" preserveAspectRatio="none" className="sc-svg">
          <path className="sc-wire" d={`M0 ${10 + v * 6} Q250 ${34 + v * 2} 500 ${12 + v * 6} T1000 ${10 + v * 6}`} />
        </svg>
      );
    case 'sign':
      return (
        <div className="sc-sign">
          <span>{l.label ?? 'Shop'}</span>
        </div>
      );
    case 'person':
      return (
        <svg viewBox="0 0 46 90" className="sc-svg">
          <circle className="sc-person" cx="23" cy="12" r="9" />
          <path className="sc-person" d="M10 90 L13 34 Q23 24 33 34 L36 90 Z" />
          {v === 4 && <circle className="sc-balloon" cx="40" cy="6" r="6" />}
        </svg>
      );
    case 'billboard':
      return (
        <div className="sc-billboard">
          <Store size={16} aria-hidden /> <span>Your store, online</span>
        </div>
      );
    case 'stall':
    case 'awning':
    case 'shopfront':
      return (
        <svg viewBox="0 0 96 84" className="sc-svg">
          <rect className="sc-stall-body" x="6" y="34" width="84" height="50" rx="4" />
          <path className={`sc-awning sc-awning-${v % 3}`} d="M0 18 H96 L90 38 H6 Z" />
          {l.kind === 'shopfront' && <rect className="sc-win" x="18" y="46" width="60" height="20" rx="3" />}
          {l.kind !== 'shopfront' && [0, 1, 2, 3].map((i) => <circle key={i} className={`sc-produce sc-produce-${(i + v) % 3}`} cx={20 + i * 18} cy="50" r="6" />)}
        </svg>
      );
    case 'bus':
      return (
        <svg viewBox="0 0 170 70" className="sc-svg">
          <rect className="sc-bus" x="4" y="8" width="160" height="48" rx="10" />
          {[0, 1, 2, 3, 4].map((i) => <rect key={i} className="sc-win" x={14 + i * 28} y="16" width="20" height="16" rx="3" />)}
          <circle className="sc-wheel" cx="36" cy="58" r="10" />
          <circle className="sc-wheel" cx="134" cy="58" r="10" />
        </svg>
      );
    case 'bike':
      return (
        <svg viewBox="0 0 96 84" className="sc-svg">
          <circle className="sc-wheel-o" cx="22" cy="62" r="16" />
          <circle className="sc-wheel-o" cx="76" cy="62" r="16" />
          <path className="sc-frame" d="M22 62 L44 36 L76 62 M44 36 L60 36 M40 30 L52 30" />
        </svg>
      );
    case 'box3d':
      return (
        <div className={`sc-cube sc-cube-${v % 5}`}>
          <i className="f" />
          <i className="t" />
          <i className="s" />
        </div>
      );
    case 'phone3d':
      return (
        <div className="sc-phone">
          <div className="sc-phone-screen">
            <div className="sc-phone-bar" />
            <div className="sc-phone-head">
              <span className="sc-phone-logo">
                <Store size={16} aria-hidden />
              </span>
              <span>
                <b>Your store</b>
                <em>Ilorin · open now</em>
              </span>
            </div>
            <div className="sc-phone-grid">
              {[0, 1, 2, 3].map((i) => (
                <span key={i} className={`sc-phone-tile t${i}`} />
              ))}
            </div>
            <div className="sc-phone-cta">Order</div>
          </div>
        </div>
      );
    case 'scooter3d':
      return (
        <svg viewBox="0 0 150 110" className="sc-svg sc-scooter">
          <circle className="sc-wheel" cx="30" cy="88" r="18" />
          <circle className="sc-wheel" cx="120" cy="88" r="18" />
          <path className="sc-scooter-body" d="M30 88 L55 58 H100 L120 88 Z" />
          <rect className="sc-scooter-box" x="18" y="40" width="40" height="30" rx="6" />
          <circle className="sc-rider" cx="92" cy="22" r="11" />
          <path className="sc-rider" d="M82 34 Q92 28 102 34 L104 60 H80 Z" />
        </svg>
      );
    case 'pin3d':
      return (
        <div className={`sc-pin sc-pin-${v % 4}`}>
          <span />
        </div>
      );
    case 'parcel3d':
      return (
        <div className="sc-cube sc-parcel">
          <i className="f" />
          <i className="t" />
          <i className="s" />
        </div>
      );
    case 'tag3d':
      return (
        <div className="sc-tag">
          <PackageCheck size={14} aria-hidden /> Order
        </div>
      );
    case 'cart3d':
      return (
        <svg viewBox="0 0 70 60" className="sc-svg">
          <path className="sc-frame" d="M4 8 H14 L22 40 H58 L64 16 H18" />
          <circle className="sc-wheel" cx="26" cy="50" r="5" />
          <circle className="sc-wheel" cx="54" cy="50" r="5" />
        </svg>
      );
    case 'card': {
      const Icon = l.tone === 'success' ? Check : l.tone === 'info' ? Truck : l.tone === 'accent' ? Check : Store;
      return (
        <div className={`sc-card tone-${l.tone ?? 'primary'}`}>
          <span className="sc-card-ico">
            <Icon size={14} aria-hidden />
          </span>
          {l.label}
        </div>
      );
    }
    case 'bubble':
      return (
        <div className={`sc-bubble${v === 0 ? ' is-chat' : ''}`}>
          {v === 0 ? <MessageCircle size={18} aria-hidden /> : v === 1 ? <Store size={18} aria-hidden /> : <Truck size={18} aria-hidden />}
        </div>
      );
    case 'connector':
      return (
        <svg viewBox="0 0 140 44" className="sc-svg">
          <path className="sc-connector" d="M4 40 C40 4 100 44 136 6" />
        </svg>
      );
    case 'step':
      return <div className="sc-step">{(v % 3) + 1}</div>;
    case 'leaf':
      return (
        <svg viewBox="0 0 120 120" className="sc-svg">
          <path className="sc-leaf" d={v % 2 ? 'M110 110 C40 100 10 60 20 10 C70 20 104 54 110 110 Z' : 'M10 110 C80 100 110 60 100 10 C50 20 16 54 10 110 Z'} />
        </svg>
      );
    case 'dust':
      return <div className="sc-fill sc-dust" />;
    case 'rays':
      return <div className="sc-fill sc-rays" />;
    case 'edgeblur':
      return <div className={`sc-fill sc-edge sc-edge-${v}`} />;
    case 'cursorglow':
      return <div className="sc-cursor" />;
    case 'progress':
      return (
        <div className="sc-progress">
          <i />
        </div>
      );
    default:
      return null;
  }
}

export function LandingScene() {
  const tier = useSceneTier();
  const layers = useMemo(() => layersForTier(tier), [tier]);
  const root = useRef<HTMLDivElement | null>(null);
  const [debug, setDebug] = useState(false);
  const [fps, setFps] = useState(0);

  useEffect(() => {
    setDebug(process.env.NODE_ENV !== 'production' && new URLSearchParams(window.location.search).has('sceneDebug'));
  }, []);

  // One scroll source, transform/opacity only, paused when off-screen.
  useEffect(() => {
    const el = root.current;
    if (!el || tier === 'lite') {
      el?.style.setProperty('--p', '0');
      return;
    }
    const items = Array.from(el.querySelectorAll<HTMLElement>('[data-speed]'));
    const meta = items.map((n) => ({
      n,
      speed: Number(n.dataset.speed),
      a: Number(n.dataset.a),
      b: Number(n.dataset.b),
    }));
    let raf = 0;
    let visible = true;
    let frames = 0;
    let last = performance.now();
    const frame = () => {
      raf = 0;
      if (!visible || document.hidden) return;
      const rect = el.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, -rect.top / Math.max(1, rect.height)));
      const y = -rect.top;
      el.style.setProperty('--p', p.toFixed(3));
      for (const m of meta) {
        const local = Math.min(1, Math.max(0, (p - m.a) / Math.max(0.0001, m.b - m.a)));
        m.n.style.transform = `translate3d(0, ${(y * (m.speed - 1) * 0.35).toFixed(1)}px, 0)`;
        m.n.style.setProperty('--lp', local.toFixed(3));
      }
      frames++;
      const now = performance.now();
      if (debug && now - last > 500) {
        setFps(Math.round((frames * 1000) / (now - last)));
        frames = 0;
        last = now;
      }
    };
    const request = () => {
      if (!raf) raf = requestAnimationFrame(frame);
    };
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible) request();
    });
    io.observe(el);
    const onPointer = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', `${(((e.clientX - r.left) / r.width) * 100).toFixed(1)}%`);
      el.style.setProperty('--my', `${(((e.clientY - r.top) / r.height) * 100).toFixed(1)}%`);
      el.style.setProperty('--tx', (((e.clientX - r.left) / r.width - 0.5) * 2).toFixed(3));
      el.style.setProperty('--ty', (((e.clientY - r.top) / r.height - 0.5) * 2).toFixed(3));
    };
    window.addEventListener('scroll', request, { passive: true });
    window.addEventListener('resize', request);
    if (tier === 'full' || tier === 'standard') el.addEventListener('pointermove', onPointer, { passive: true });
    request();
    return () => {
      io.disconnect();
      window.removeEventListener('scroll', request);
      window.removeEventListener('resize', request);
      el.removeEventListener('pointermove', onPointer);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [tier, layers, debug]);

  return (
    <div ref={root} className={`sc tier-${tier}`} aria-hidden data-layers={layers.length}>
      {layers.map((l) => (
        <div
          key={l.id}
          className={`sc-layer band-${l.band} t-${l.type.replace('.', '')} k-${l.kind}`}
          data-speed={l.parallaxSpeed}
          data-a={l.scrollRange[0]}
          data-b={l.scrollRange[1]}
          style={{
            left: `${l.x}%`,
            top: `${l.y}%`,
            width: l.w <= 100 && ['sky', 'horizon', 'haze', 'pattern', 'grain', 'vignette', 'stars', 'powerline', 'rays', 'dust', 'edgeblur', 'progress'].includes(l.kind) ? `${l.w}%` : l.w,
            height: l.h <= 100 && ['sky', 'horizon', 'haze', 'pattern', 'grain', 'vignette', 'stars', 'rays', 'edgeblur', 'progress'].includes(l.kind) ? `${l.h}%` : l.h,
            zIndex: 1000 + l.depth,
          }}
        >
          <Art l={l} />
        </div>
      ))}
      {debug && (
        <div className="sc-debug">
          tier {tier} · {layers.length} layers · {fps} fps
        </div>
      )}
    </div>
  );
}

/** "Reduce effects" control (footer + near the top of the landing page). */
export function ReduceEffectsToggle({ className }: { className?: string }) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    setOn(document.documentElement.classList.contains('reduce-effects'));
  }, []);
  const toggle = () => {
    const next = !on;
    setOn(next);
    document.documentElement.classList.toggle('reduce-effects', next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
    } catch {
      /* private mode */
    }
    if (next) window.dispatchEvent(new Event('nv-reduce-effects'));
    else window.location.reload(); // re-run the tier probe cleanly
  };
  return (
    <button type="button" className={`chip${on ? ' is-active' : ''}${className ? ` ${className}` : ''}`} aria-pressed={on} onClick={toggle}>
      Reduce effects
    </button>
  );
}
