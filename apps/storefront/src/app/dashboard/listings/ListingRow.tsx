'use client';

// One listing row in the seller dashboard. The static parts (thumb, title,
// badges) come from the server via props; the Edit button toggles an inline
// ListingEditor pre-filled with this listing. Collapsing resets the editor
// back to its initial values (key remount), so a half-done edit never leaks
// into another listing's editor.
import { useState } from 'react';
import Link from 'next/link';
import { ListingEditor } from './ListingEditor';
import type { Listing } from '@idevtenancy/shared';

export function ListingRow({
  listing,
  storeId,
  previewUrl,
  removeAction,
  children,
}: {
  listing: Listing;
  storeId: string;
  previewUrl: string;
  removeAction: React.ReactElement;
  children: React.ReactNode; // the server-rendered static summary
}) {
  const [editing, setEditing] = useState(false);

  return (
    <div
      className="card"
      style={{
        display: 'grid',
        gap: 14,
        marginBottom: 10,
        borderColor: editing ? 'var(--blue)' : undefined,
      }}
    >
      <div className="dash-listing-row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
        {children}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <Link className="btn btn-outline btn-sm" href={previewUrl} target="_blank">
            Preview ↗
          </Link>
          <button
            type="button"
            className={`btn btn-sm ${editing ? 'btn-black' : 'btn-outline'}`}
            aria-expanded={editing}
            onClick={() => setEditing((v) => !v)}
          >
            {editing ? 'Close editor' : '✏️ Edit'}
          </button>
          {removeAction}
        </div>
      </div>
      {editing && (
        <div style={{ borderTop: '1px dashed var(--border)', paddingTop: 14 }}>
          <ListingEditor key={listing.id} storeId={storeId} listing={listing} />
        </div>
      )}
    </div>
  );
}
