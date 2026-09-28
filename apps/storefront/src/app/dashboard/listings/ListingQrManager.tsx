'use client';

import { useState } from 'react';
import { StoreQrCode } from '@/components/StoreQrCode';

// Per-listing QR manager for the seller dashboard: expand a listing row to get
// its branded, downloadable QR (points at the product page), plus a bulk
// "print sheet" that opens all QRs in one printable grid.

export interface ListingQrItem {
  id: string;
  title: string;
  storeSlug: string;
  storeName: string;
  siteUrl: string;
}

export function ListingQrManager({ items }: { items: ListingQrItem[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  if (items.length === 0) return null;

  return (
    <div className="qr-manager">
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => setSheetOpen((v) => !v)} aria-expanded={sheetOpen}>
          🖨️ {sheetOpen ? 'Hide print sheet' : 'Print all QR tags'}
        </button>
        <span className="hint" style={{ margin: 0 }}>
          Each product gets its own QR — perfect for price tags and market stalls.
        </span>
      </div>

      {sheetOpen && (
        <div className="card qr-sheet" aria-label="Printable QR sheet">
          <div className="qr-sheet-actions no-print">
            <button type="button" className="btn btn-primary btn-sm" onClick={() => window.print()}>
              Print / Save as PDF
            </button>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setSheetOpen(false)}>
              Close
            </button>
          </div>
          <div className="qr-sheet-grid">
            {items.map((l) => (
              <div key={l.id} className="qr-sheet-cell">
                <StoreQrCode
                  url={`${l.siteUrl}/s/${l.storeSlug}/listing/${l.id}`}
                  storeName={l.storeName}
                  productName={l.title}
                  tagline="Scan to view product"
                  variant="card"
                  title={l.title.slice(0, 28) + (l.title.length > 28 ? '…' : '')}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      <ul className="qr-manager-list">
        {items.map((l) => (
          <li key={l.id}>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              aria-expanded={openId === l.id}
              onClick={() => setOpenId(openId === l.id ? null : l.id)}
            >
              QR
            </button>
            {openId === l.id && (
              <div className="qr-manager-pop" role="dialog" aria-label={`${l.title} QR code`}>
                <StoreQrCode
                  url={`${l.siteUrl}/s/${l.storeSlug}/listing/${l.id}`}
                  storeName={l.storeName}
                  productName={l.title}
                  tagline="Scan to view product"
                  variant="card"
                  title={l.title}
                />
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
