'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export interface StaffRow {
  id: string;
  display_name: string;
  role: string;
  active: boolean;
}

// Staff manager: the tier-2 owner invites people under their store. Each gets
// a real sign-in (temp password shown once), a role, and can be suspended or
// removed — which revokes their access immediately.
export function StaffManager({ slug, locations }: { slug: string; locations?: { id: string; label: string }[] }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'cashier' | 'manager'>('cashier');
  const [locationIds, setLocationIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issued, setIssued] = useState<{ name: string; email: string; tempPassword: string } | null>(null);

  async function invite() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, name, email, role, locationIds }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message ?? 'Could not add the staff member.');
        return;
      }
      setIssued({ name, email, tempPassword: json.tempPassword });
      setName('');
      setEmail('');
      router.refresh();
    } catch {
      setError('Network error — try again.');
    } finally {
      setBusy(false);
    }
  }

  async function toggle(id: string, active: boolean) {
    await fetch('/api/staff', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug, staffId: id, active }),
    });
    router.refresh();
  }

  async function remove(id: string) {
    await fetch('/api/staff', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug, staffId: id }),
    });
    router.refresh();
  }

  return (
    <div>
      <div className="staff-invite">
        <div className="staff-invite-fields">
          <label className="field">
            <span>Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Chioma" />
          </label>
          <label className="field">
            <span>Email</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="staff@email.com" />
          </label>
          <label className="field">
            <span>Role</span>
            <select value={role} onChange={(e) => setRole(e.target.value as 'cashier' | 'manager')}>
              <option value="cashier">Cashier — POS only</option>
              <option value="manager">Manager — POS + orders view</option>
            </select>
          </label>
        </div>
        {locations && locations.length > 0 && (
          <div className="field">
            <span style={{ fontSize: 13.5, fontWeight: 600 }}>Works at</span>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
              {locations.map((loc) => {
                const on = locationIds.includes(loc.id);
                return (
                  <button
                    key={loc.id}
                    type="button"
                    className={`filter-chip${on ? ' is-active' : ''}`}
                    style={{ cursor: 'pointer' }}
                    aria-pressed={on}
                    onClick={() => setLocationIds((prev) => (on ? prev.filter((x) => x !== loc.id) : [...prev, loc.id]))}
                  >
                    📍 {loc.label}
                  </button>
                );
              })}
            </div>
            <p className="hint" style={{ marginTop: 6 }}>
              {locationIds.length === 0
                ? 'Untagged staff work at every branch.'
                : 'This person will only appear on the tagged branches.'}
            </p>
          </div>
        )}
        <button className="btn btn-primary" type="button" onClick={invite} disabled={busy || name.length < 2 || email.length < 5}>
          {busy ? 'Adding…' : '+ Add staff member'}
        </button>
        {error && <div className="alert alert-error" style={{ marginTop: 10 }}>{error}</div>}
      </div>

      {issued && (
        <div className="alert alert-success" role="status" style={{ marginTop: 12 }}>
          <div>
            <strong>{issued.name}</strong> added! Their temporary password is{' '}
            <code style={{ userSelect: 'all', fontWeight: 700 }}>{issued.tempPassword}</code> — share it now,
            it won't be shown again.
          </div>
        </div>
      )}

      <p className="muted" style={{ fontSize: 13.5, marginTop: 12 }}>
        Staff sign in at <strong>/dashboard/signin</strong> like you do — they only see the POS and
        their own tasks, never your settings or payouts.
      </p>
    </div>
  );
}
