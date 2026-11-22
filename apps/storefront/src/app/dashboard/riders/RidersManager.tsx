'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bike, Car, Footprints, MessageCircle, Phone, Plus, Truck, type LucideIcon } from 'lucide-react';

export interface RiderRow {
  id: string;
  name: string;
  phone: string;
  vehicle: string;
  active: boolean;
}

const VEHICLES: Array<{ id: string; label: string; Icon: LucideIcon }> = [
  { id: 'bike', label: 'Okada / bike', Icon: Bike },
  { id: 'tricycle', label: 'Keke', Icon: Truck },
  { id: 'car', label: 'Car', Icon: Car },
  { id: 'van', label: 'Van', Icon: Truck },
  { id: 'foot', label: 'On foot', Icon: Footprints },
];

export function RidersManager({ riders }: { riders: RiderRow[] }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [vehicle, setVehicle] = useState('bike');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function post(body: Record<string, unknown>) {
    const res = await fetch('/api/dashboard/riders', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = (await res.json()) as { error?: { message?: string } };
    if (!res.ok) throw new Error(json.error?.message ?? 'Could not save.');
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      await post({ name, phone, vehicle });
      setName('');
      setPhone('');
      router.refresh();
    } catch (err) {
      setMsg((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function toggle(r: RiderRow) {
    try {
      await post({ id: r.id, active: !r.active });
      router.refresh();
    } catch (err) {
      setMsg((err as Error).message);
    }
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <form className="card dsp-form" onSubmit={add}>
        <h2 style={{ margin: 0, fontSize: 16 }}>Add a rider</h2>
        <div className="dsp-form-row">
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Name, e.g. Musa Bello" aria-label="Rider name" />
          <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone, e.g. 08012345678" inputMode="tel" aria-label="Rider phone" />
          <select className="input" value={vehicle} onChange={(e) => setVehicle(e.target.value)} aria-label="Vehicle">
            {VEHICLES.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label}
              </option>
            ))}
          </select>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            <Plus size={16} aria-hidden /> {busy ? 'Adding…' : 'Add rider'}
          </button>
        </div>
        {msg && (
          <p role="alert" style={{ margin: 0, color: 'var(--danger)', fontSize: 13 }}>
            {msg}
          </p>
        )}
        <p className="muted" style={{ margin: 0, fontSize: 12.5 }}>
          Riders don&apos;t need an account. For each delivery you send them a private link on WhatsApp; they update the
          status there and finish with the buyer&apos;s 4-digit code.
        </p>
      </form>

      {riders.length === 0 ? (
        <div className="empty-state">No riders yet. Add the people who deliver for you.</div>
      ) : (
        <ul className="dsp-riders">
          {riders.map((r) => {
            const V = VEHICLES.find((v) => v.id === r.vehicle) ?? VEHICLES[0]!;
            const digits = r.phone.replace(/\D/g, '');
            return (
              <li key={r.id} className={r.active ? 'card dsp-rider' : 'card dsp-rider is-off'}>
                <span className="dsp-rider-ico" aria-hidden>
                  <V.Icon size={18} />
                </span>
                <span className="dsp-rider-main">
                  <strong>{r.name}</strong>
                  <span className="muted mono">{r.phone}</span>
                  <span className="muted">{V.label}</span>
                </span>
                <span className="dsp-rider-actions">
                  <a className="btn btn-outline btn-sm" href={`tel:${r.phone}`} aria-label={`Call ${r.name}`}>
                    <Phone size={14} aria-hidden />
                  </a>
                  <a className="btn btn-whatsapp btn-sm" href={`https://wa.me/${digits}`} target="_blank" rel="noopener noreferrer" aria-label={`WhatsApp ${r.name}`}>
                    <MessageCircle size={14} aria-hidden />
                  </a>
                  <button type="button" className={r.active ? 'btn btn-outline btn-sm' : 'btn btn-cta btn-sm'} onClick={() => toggle(r)} aria-pressed={r.active}>
                    {r.active ? 'Switch off' : 'Switch on'}
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
