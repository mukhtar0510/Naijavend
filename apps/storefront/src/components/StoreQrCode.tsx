'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { LinkIcon, CheckIcon } from '@/components/SocialIcons';

// Branded QR codes for Naijavend store + product sharing — a custom card
// layout, not just a bare square: glacier-blue frame with a header band
// ("SCAN ME" + store/product name), the QR modules in the seller's accent,
// a centre logo well (seller logo, or the built-in Naijavend mark), and a
// footer band with the store name + URL. The whole card downloads as one PNG,
// so flyers, price tags and shop windows get the full branded layout.
// Rendered client-side with `qrcode` — no server cost, no external image API.

interface StoreQrCodeProps {
  /** Absolute URL the QR points at (store home, catalogue, listing…). */
  url: string;
  /** Store name — used for the download filename + aria labels. */
  storeName: string;
  /** Accent colour from the store theme (any CSS hex). */
  accent?: string | null;
  /** Absolute logo URL (store theme logo/favicon), optional. */
  logoUrl?: string | null;
  /** Renders a compact toggle button (share bar) vs always-open card (dashboard). */
  variant?: 'sharebar' | 'card';
  /** Card variant heading. */
  title?: string;
  /** Product name printed under the QR (listing QRs). Falls back to storeName. */
  productName?: string | null;
  /** Optional tag line in the footer band (e.g. "Scan · Chat · Order"). */
  tagline?: string | null;
}

const QUIET_ZONE = 14; // px white margin around the modules — required for scans
const CARD_W = 520; // logical card width of the exported PNG

/** Built-in Naijavend fallback logo: rounded badge with a location-pin + bag. */
function drawDefaultLogo(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, accent: string) {
  const r = size / 2;
  ctx.save();
  // White well.
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(cx, cy, r + 6, 0, Math.PI * 2);
  ctx.fill();
  // Rounded square badge in the store accent.
  const s = size;
  const x0 = cx - s / 2;
  const y0 = cy - s / 2;
  const rad = s * 0.24;
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.moveTo(x0 + rad, y0);
  ctx.arcTo(x0 + s, y0, x0 + s, y0 + s, rad);
  ctx.arcTo(x0 + s, y0 + s, x0, y0 + s, rad);
  ctx.arcTo(x0, y0 + s, x0, y0, rad);
  ctx.arcTo(x0, y0, x0 + s, y0, rad);
  ctx.closePath();
  ctx.fill();
  // Pin glyph in white.
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(cx, cy - s * 0.12, s * 0.17, Math.PI, 0);
  ctx.lineTo(cx, cy + s * 0.22);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.arc(cx, cy - s * 0.12, s * 0.07, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function StoreQrCode({
  url,
  storeName,
  accent = '#1D4ED8',
  logoUrl = null,
  variant = 'sharebar',
  title = 'QR code',
  productName = null,
  tagline = 'Scan to open',
}: StoreQrCodeProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [open, setOpen] = useState(variant === 'card');
  const [error, setError] = useState<string | null>(null);
  const [logoOk, setLogoOk] = useState(false);
  const [copied, setCopied] = useState(false);

  const themeAccent = accent || '#1D4ED8';
  const displayName = productName || storeName;

  const draw = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setError(null);
    setLogoOk(false);
    try {
      // 1. Raw QR modules.
      const qr = document.createElement('canvas');
      await QRCode.toCanvas(qr, url, {
        width: 360,
        margin: 0,
        errorCorrectionLevel: 'H', // survives the logo overlay + phone screens
        color: { dark: themeAccent, light: '#FFFFFF' },
      });
      const qrSide = qr.width + QUIET_ZONE * 2;

      // 2. Full branded card layout: header band, QR well, footer band.
      const headerH = 96;
      const footerH = 88;
      const padX = 26;
      const cardH = headerH + qrSide + footerH + 24;
      canvas.width = CARD_W;
      canvas.height = cardH;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Card background + accent header/footer bands.
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, CARD_W, cardH);
      ctx.fillStyle = themeAccent;
      ctx.fillRect(0, 0, CARD_W, headerH);
      ctx.fillRect(0, cardH - footerH, CARD_W, footerH);

      // Header: SCAN ME pill + store/product name.
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 30px Sora, Arial, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText('SCAN ME', padX, headerH / 2 - 10);
      ctx.font = '600 17px Inter, Arial, sans-serif';
      ctx.globalAlpha = 0.92;
      let sub = 'Point your camera at the code';
      if (ctx.measureText(sub).width > CARD_W - padX * 2 - 150) sub = 'Camera → code';
      ctx.fillText(sub, padX, headerH / 2 + 18);
      ctx.globalAlpha = 1;

      // QR centred in the middle well with its own quiet zone.
      const qrY = headerH + 12;
      const qrX = Math.round((CARD_W - qrSide) / 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(qrX, qrY, qrSide, qrSide);
      ctx.drawImage(qr, qrX + QUIET_ZONE, qrY + QUIET_ZONE);

      // Centre logo: seller logo when available, else the built-in mark.
      const cx = qrX + qrSide / 2;
      const cy = qrY + qrSide / 2;
      const well = Math.round(qrSide * 0.22);
      if (logoUrl) {
        await new Promise<void>((resolve) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            ctx.fillStyle = '#FFFFFF';
            ctx.beginPath();
            ctx.arc(cx, cy, well / 2 + 6, 0, Math.PI * 2);
            ctx.fill();
            const half = well / 2;
            ctx.drawImage(img, cx - half, cy - half, well, well);
            setLogoOk(true);
            resolve();
          };
          img.onerror = () => resolve(); // fall back to the default mark below
          img.src = logoUrl;
        });
      }
      if (!logoOk) drawDefaultLogo(ctx, cx, cy, well, themeAccent);

      // Footer band: name (clamped) + short URL.
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.font = '800 24px Sora, Arial, sans-serif';
      let name = displayName;
      while (ctx.measureText(name).width > CARD_W - padX * 2 && name.length > 4) name = name.slice(0, -2);
      if (name !== displayName) name += '…';
      ctx.fillText(name, CARD_W / 2, cardH - footerH + 30);
      ctx.font = '500 16px Inter, Arial, sans-serif';
      ctx.globalAlpha = 0.9;
      let link = url.replace(/^https?:\/\//, '');
      while (ctx.measureText(link).width > CARD_W - padX * 2 && link.length > 6) link = link.slice(0, -2);
      if (link !== url.replace(/^https?:\/\//, '')) link += '…';
      ctx.fillText(link, CARD_W / 2, cardH - footerH + 60);
      ctx.globalAlpha = 1;
    } catch {
      setError('Could not render the QR code.');
    }
  }, [url, themeAccent, logoUrl, logoOk, displayName]);

  useEffect(() => {
    if (open) void draw();
  }, [open, draw]);

  function download() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `${storeName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-qr.png`;
    a.click();
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (variant === 'sharebar') {
    return (
      <>
        <button
          type="button"
          className="share-btn"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={`Show QR code for ${storeName}`}
        >
          <QrGlyph /> QR
        </button>
        {open && (
          <div className="qr-pop" role="dialog" aria-label={`${storeName} QR code`}>
            <QrCanvas
              canvasRef={canvasRef}
              error={error}
              storeName={storeName}
              url={url}
              copied={copied}
              onDownload={download}
              onCopy={copyLink}
            />
          </div>
        )}
      </>
    );
  }

  return (
    <div className="card qr-card" aria-label={`${title} — ${storeName}`}>
      <h3 style={{ marginTop: 0, fontSize: 16 }}>{title}</h3>
      <p className="hint" style={{ marginTop: 0 }}>
        Print it on flyers, price tags or your shop window — scanning opens {productName ? 'this product' : 'your store'} instantly.
      </p>
      <QrCanvas
        canvasRef={canvasRef}
        error={error}
        storeName={storeName}
        url={url}
        copied={copied}
        onDownload={download}
        onCopy={copyLink}
      />
    </div>
  );
}

function QrCanvas({
  canvasRef,
  error,
  storeName,
  url,
  copied,
  onDownload,
  onCopy,
}: {
  canvasRef: React.MutableRefObject<HTMLCanvasElement | null>;
  error: string | null;
  storeName: string;
  url: string;
  copied: boolean;
  onDownload: () => void;
  onCopy: () => void;
}) {
  return (
    <div style={{ display: 'grid', gap: 10, justifyItems: 'center' }}>
      <canvas
        ref={canvasRef}
        className="qr-canvas"
        role="img"
        aria-label={`QR code linking to ${storeName}`}
      />
      {error && <p className="field-error" style={{ margin: 0 }}>{error}</p>}
      <button type="button" className="btn btn-outline btn-sm" onClick={onDownload}>
        Download PNG ⬇
      </button>
      <button type="button" className="btn btn-outline btn-sm" onClick={onCopy} aria-label="Copy the link">
        {copied ? <CheckIcon size={14} /> : <LinkIcon size={14} />} {copied ? 'Link copied!' : 'Copy link'}
      </button>
      <code
        className="qr-link muted"
        style={{ fontSize: 11.5, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}
        title={url}
      >
        {url.replace(/^https?:\/\//, '')}
      </code>
    </div>
  );
}

function QrGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <path d="M14 14h3v3h-3zM19 19h2v2h-2z" />
    </svg>
  );
}
