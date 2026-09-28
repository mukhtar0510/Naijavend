'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BUSINESS_DAYS, type BusinessHours } from '@idevtenancy/shared';

const DAY_LABELS: Record<(typeof BUSINESS_DAYS)[number], string> = {
  mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday',
};

export interface LocationRow {
  id: string;
  label: string;
  position: number;
  address: string;
  latitude: number | null;
  longitude: number | null;
  phone: string;
  note: string;
  image_url?: string | null;
  business_hours: BusinessHours | null;
}

interface DraftState {
  label: string;
  address: string;
  lat: string;
  lng: string;
  phone: string;
  note: string;
  imageUrl: string | null;
  hours: BusinessHours;
}

function emptyDraft(): DraftState {
  return { label: '', address: '', lat: '', lng: '', phone: '', note: '', imageUrl: null, hours: {} };
}

function draftFromRow(row: LocationRow): DraftState {
  return {
    label: row.label,
    address: row.address ?? '',
    lat: row.latitude?.toString() ?? '',
    lng: row.longitude?.toString() ?? '',
    phone: row.phone ?? '',
    note: row.note ?? '',
    imageUrl: row.image_url ?? null,
    hours: (row.business_hours as BusinessHours | null) ?? {},
  };
}

async function uploadLocationPhoto(file: File): Promise<string> {
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch('/api/listings/upload-image', { method: 'POST', body: fd });
  const body = await res.json();
  if (!res.ok) throw new Error(body?.error?.message ?? 'Photo upload failed.');
  return body.url as string;
}

/**
 * Multi-location manager: add named branches ("Lekki shop", "Yaba kiosk" —
 * or plain Store 1 / Store 2), each with its own address, pin, phone and
 * opening hours. Staff can be tagged to branches on the Staff page.
 */
export function LocationsCard({ storeName, initialLocations }: { storeName: string; initialLocations: LocationRow[] }) {
  const router = useRouter();
  const [locations, setLocations] = useState<LocationRow[]>(initialLocations);
  const [draft, setDraft] = useState<DraftState>(emptyDraft());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const set = (patch: Partial<DraftState>) => setDraft((d) => ({ ...d, ...patch }));

  function startNew() {
    setEditingId(null);
    setDraft(emptyDraft());
  }

  function startEdit(row: LocationRow) {
    setEditingId(row.id);
    setDraft(draftFromRow(row));
  }

  async function save() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const payload = {
        id: editingId,
        label: draft.label,
        address: draft.address,
        latitude: draft.lat === '' ? null : Number(draft.lat),
        longitude: draft.lng === '' ? null : Number(draft.lng),
        phone: draft.phone,
        note: draft.note,
        imageUrl: draft.imageUrl,
        businessHours: draft.hours,
      };
      const res = await fetch('/api/locations', {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? 'Could not save the branch.');
      setMessage(editingId ? 'Branch updated.' : `${draft.label} added.`);
      setDraft(emptyDraft());
      setEditingId(null);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string, label: string) {
    if (!confirm(`Remove "${label}"? This can't be undone.`)) return;
    setBusy(true);
    try {
      await fetch(`/api/locations?id=${id}`, { method: 'DELETE' });
      setLocations((rows) => rows.filter((r) => r.id !== id));
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const editing = editingId ? locations.find((r) => r.id === editingId) : null;

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <h2 style={{ fontSize: 18 }}>📍 Locations</h2>
      <p className="hint" style={{ marginTop: 0 }}>
        Have more than one shop? Add each branch here — they all show on your store site with
        their own address, phone and hours. Your main address above is branch one.
      </p>

      {message && <div className="alert alert-success">{message}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      {locations.length > 0 && (
        <div style={{ display: 'grid', gap: 10, marginBottom: 16 }}>
          {locations.map((row, i) => (
            <div key={row.id} className="card card-elevated" style={{ padding: '12px 14px', marginBottom: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                <strong>Store {i + 1} · {row.label}</strong>
                <span style={{ display: 'flex', gap: 8 }}>
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => startEdit(row)} disabled={busy}>Edit</button>
                  <button type="button" className="btn btn-outline btn-sm" style={{ color: 'var(--danger)' }} onClick={() => remove(row.id, row.label)} disabled={busy}>Remove</button>
                </span>
              </div>
              <p className="muted" style={{ margin: '6px 0 0', fontSize: 13.5 }}>
                {row.address || 'No address yet'}
                {row.phone ? ` · 📞 ${row.phone}` : ''}
                {row.note ? ` — ${row.note}` : ''}
              </p>
              {row.image_url && (
                // eslint-disable-next-line @next/next/no-img-element -- seller-uploaded URL
                <img
                  src={row.image_url}
                  alt={`${row.label} photo`}
                  style={{ width: '100%', height: 110, objectFit: 'cover', borderRadius: 10, marginTop: 8, border: '1px solid var(--border)' }}
                />
              )}
            </div>
          ))}
        </div>
      )}

      <div className="card card-elevated" style={{ padding: '14px 16px', marginBottom: 0 }}>
        <h3 style={{ fontSize: 15.5, marginTop: 0 }}>
          {editing ? `Edit ${editing.label}` : `Add another location for ${storeName}`}
        </h3>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div className="field" style={{ flex: 1, minWidth: 180 }}>
            <label htmlFor="loc-label">Branch name</label>
            <input id="loc-label" type="text" value={draft.label} onChange={(e) => set({ label: e.target.value })} placeholder="Lekki flagship / Store 2" maxLength={60} />
          </div>
          <div className="field" style={{ flex: 1, minWidth: 180 }}>
            <label htmlFor="loc-phone">Phone (optional)</label>
            <input id="loc-phone" type="tel" value={draft.phone} onChange={(e) => set({ phone: e.target.value })} placeholder="+2348012345678" maxLength={16} />
          </div>
        </div>
        <div className="field">
          <label htmlFor="loc-addr">Address</label>
          <input id="loc-addr" type="text" value={draft.address} onChange={(e) => set({ address: e.target.value })} placeholder="5 Admiralty Way, Lekki Phase 1, Lagos" maxLength={300} />
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div className="field" style={{ flex: 1, minWidth: 140 }}>
            <label htmlFor="loc-lat">Latitude</label>
            <input id="loc-lat" type="text" value={draft.lat} onChange={(e) => set({ lat: e.target.value })} placeholder="6.4459" />
          </div>
          <div className="field" style={{ flex: 1, minWidth: 140 }}>
            <label htmlFor="loc-lng">Longitude</label>
            <input id="loc-lng" type="text" value={draft.lng} onChange={(e) => set({ lng: e.target.value })} placeholder="3.4707" />
          </div>
        </div>
        <div className="field">
          <label htmlFor="loc-note">Note (optional)</label>
          <input id="loc-note" type="text" value={draft.note} onChange={(e) => set({ note: e.target.value })} placeholder="Inside Century Mall, ground floor" maxLength={160} />
        </div>

        <div className="field">
          <label>Location photo (optional)</label>
          {draft.imageUrl ? (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              {/* eslint-disable-next-line @next/next/no-img-element -- seller-uploaded URL */}
              <img
                src={draft.imageUrl}
                alt="Branch photo preview"
                style={{ width: 110, height: 74, objectFit: 'cover', borderRadius: 10, border: '1px solid var(--border)' }}
              />
              <button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={() => set({ imageUrl: null })}>
                Remove photo
              </button>
            </div>
          ) : (
            <label className="btn btn-outline btn-sm" style={{ cursor: busy ? 'wait' : 'pointer' }}>
              {busy ? 'Uploading…' : '+ Add a photo of this spot'}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  e.target.value = '';
                  if (file.size > 5 * 1024 * 1024) {
                    setError('Each image must be 5 MB or smaller.');
                    return;
                  }
                  setBusy(true);
                  setError(null);
                  uploadLocationPhoto(file)
                    .then((url) => set({ imageUrl: url }))
                    .catch((err) => setError((err as Error).message))
                    .finally(() => setBusy(false));
                }}
              />
            </label>
          )}
          <p className="hint">A street-level photo helps customers recognise the exact spot when they arrive.</p>
        </div>

        <details>
          <summary style={{ cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>Opening hours for this branch</summary>
          <div style={{ display: 'grid', gap: 6, marginTop: 10 }}>
            {BUSINESS_DAYS.map((day) => {
              const range = draft.hours[day] ?? null;
              const open = Boolean(range);
              return (
                <div key={day} style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <label style={{ display: 'flex', gap: 8, alignItems: 'center', width: 150, fontSize: 14 }}>
                    <input
                      type="checkbox"
                      checked={open}
                      onChange={() =>
                        setDraft((d) => {
                          const hours = { ...d.hours };
                          hours[day] = hours[day] ? null : ['09:00', '18:00'];
                          return { ...d, hours };
                        })
                      }
                      style={{ width: 'auto' }}
                    />
                    {DAY_LABELS[day]}
                  </label>
                  {open && range ? (
                    <span style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 14 }}>
                      <input
                        type="time"
                        aria-label={`${DAY_LABELS[day]} opens`}
                        value={range[0]}
                        onChange={(e) => setDraft((d) => ({ ...d, hours: { ...d.hours, [day]: [e.target.value, d.hours[day]?.[1] ?? '18:00'] } }))}
                        style={{ width: 110 }}
                      />
                      –
                      <input
                        type="time"
                        aria-label={`${DAY_LABELS[day]} closes`}
                        value={range[1]}
                        onChange={(e) => setDraft((d) => ({ ...d, hours: { ...d.hours, [day]: [d.hours[day]?.[0] ?? '09:00', e.target.value] } }))}
                        style={{ width: 110 }}
                      />
                    </span>
                  ) : (
                    <span className="muted" style={{ fontSize: 13.5 }}>Closed</span>
                  )}
                </div>
              );
            })}
          </div>
        </details>

        <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-primary btn-sm" onClick={save} disabled={busy || draft.label.length < 1}>
            {busy ? 'Saving…' : editing ? 'Save branch' : 'Add branch'}
          </button>
          {editing && (
            <button type="button" className="btn btn-outline btn-sm" onClick={startNew} disabled={busy}>
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
