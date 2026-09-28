'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MapEmbed } from '@/components/MapEmbed';
import { CategoryPicker } from '@/components/CategoryPicker';
import { BUSINESS_DAYS, categoryEmoji, categoryLabel, type BusinessHours } from '@idevtenancy/shared';

interface StoreSettings {
  name: string;
  slug: string;
  category: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  whatsapp_number: string;
  social_links: Record<string, string>;
  business_hours: BusinessHours | null;
  announcement: string | null;
  delivery_info: string | null;
  is_dropshipper: boolean;
  dropship_info: string | null;
}

const DAY_LABELS: Record<(typeof BUSINESS_DAYS)[number], string> = {
  mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday',
};

const SOCIAL_FIELDS: Array<{ key: string; label: string; placeholder: string }> = [
  { key: 'instagram', label: 'Instagram', placeholder: 'amakaglow' },
  { key: 'twitter', label: 'X (Twitter)', placeholder: 'amakaglow' },
  { key: 'facebook', label: 'Facebook', placeholder: 'amakaglowstudio' },
  { key: 'tiktok', label: 'TikTok', placeholder: 'amakaglow' },
  { key: 'youtube', label: 'YouTube', placeholder: '@amakaglow' },
];

interface WhatsAppSettings {
  businessNumber: string;
  greetingMessage: string;
  catalogEnabled: boolean;
}

export function SettingsForm({ store, whatsapp }: { store: StoreSettings; whatsapp: WhatsAppSettings | null }) {
  const router = useRouter();
  const [category, setCategory] = useState(store.category);
  const [address, setAddress] = useState(store.address);
  const [lat, setLat] = useState(store.latitude?.toString() ?? '');
  const [lng, setLng] = useState(store.longitude?.toString() ?? '');
  const [whatsappNumber, setWhatsappNumber] = useState(store.whatsapp_number || whatsapp?.businessNumber || '');
  const [greeting, setGreeting] = useState(whatsapp?.greetingMessage ?? '');
  const [catalog, setCatalog] = useState(whatsapp?.catalogEnabled ?? false);
  const [socials, setSocials] = useState<Record<string, string>>(store.social_links ?? {});
  const [hours, setHours] = useState<BusinessHours>(store.business_hours ?? {});
  const [announcement, setAnnouncement] = useState(store.announcement ?? '');
  const [deliveryInfo, setDeliveryInfo] = useState(store.delivery_info ?? '');
  const [isDropshipper, setIsDropshipper] = useState(store.is_dropshipper);
  const [dropshipInfo, setDropshipInfo] = useState(store.dropship_info ?? '');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          address,
          latitude: lat === '' ? null : Number(lat),
          longitude: lng === '' ? null : Number(lng),
          whatsappNumber,
          greetingMessage: greeting,
          catalogEnabled: catalog,
          socialLinks: socials,
          announcement,
          deliveryInfo,
          businessHours: hours,
          isDropshipper,
          dropshipInfo,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? 'Could not save settings.');
      setMessage('Settings saved.');
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      setError('Your browser does not support location sharing.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(6));
        setLng(pos.coords.longitude.toFixed(6));
      },
      () => setError('Could not get your location — enter coordinates manually.')
    );
  }

  const latNum = Number(lat);
  const lngNum = Number(lng);
  const hasPin = Number.isFinite(latNum) && Number.isFinite(lngNum) && lat.length > 0 && lng.length > 0;

  return (
    <form onSubmit={save}>
      {message && <div className="alert alert-success">{message}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      <div className="card" style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 18 }}>Store category</h2>
        <p className="hint" style={{ marginTop: 0 }}>
          Where you show up on the marketplace — discover filters, rankings and the map.
          Currently: <span className="badge">{categoryEmoji(category)} {categoryLabel(category)}</span>
        </p>
        <CategoryPicker value={category} onChange={setCategory} />
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 18 }}>Location</h2>
        <div className="field">
          <label htmlFor="addr">Address</label>
          <input id="addr" type="text" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="12 Adeniran Ogunsanya St, Surulere, Lagos" maxLength={300} />
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div className="field" style={{ flex: 1, minWidth: 140 }}>
            <label htmlFor="lat">Latitude</label>
            <input id="lat" type="text" value={lat} onChange={(e) => setLat(e.target.value)} placeholder="6.4969" />
          </div>
          <div className="field" style={{ flex: 1, minWidth: 140 }}>
            <label htmlFor="lng">Longitude</label>
            <input id="lng" type="text" value={lng} onChange={(e) => setLng(e.target.value)} placeholder="3.3561" />
          </div>
        </div>
        <button type="button" className="btn btn-outline btn-sm" onClick={useMyLocation}>
          Use my current location
        </button>
        {hasPin && (
          <div style={{ marginTop: 16 }}>
            <MapEmbed latitude={latNum} longitude={lngNum} name={store.name} />
          </div>
        )}
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 18 }}>Social links</h2>
        <p className="hint" style={{ marginTop: 0 }}>
          Shown as brand icons on your store site — just enter your handle, we build the link.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0 14px' }}>
          {SOCIAL_FIELDS.map((f) => (
            <div className="field" key={f.key}>
              <label htmlFor={`soc-${f.key}`}>{f.label}</label>
              <input
                id={`soc-${f.key}`}
                type="text"
                value={socials[f.key] ?? ''}
                onChange={(e) => setSocials((prev) => ({ ...prev, [f.key]: e.target.value }))}
                placeholder={f.placeholder}
                maxLength={120}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 18 }}>Business hours</h2>
        <p className="hint" style={{ marginTop: 0 }}>
          Shown as a live "Open now / Closed" badge on your store site.
        </p>
        <div style={{ display: 'grid', gap: 8 }}>
          {BUSINESS_DAYS.map((day) => {
            const range = hours[day] ?? null;
            const open = Boolean(range);
            return (
              <div key={day} style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', gap: 8, alignItems: 'center', width: 150, fontSize: 14 }}>
                  <input
                    type="checkbox"
                    checked={open}
                    onChange={() =>
                      setHours((prev) => {
                        const next = { ...prev };
                        next[day] = next[day] ? null : ['09:00', '18:00'];
                        return next;
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
                      onChange={(e) => setHours((prev) => ({ ...prev, [day]: [e.target.value, prev[day]?.[1] ?? '18:00'] }))}
                      style={{ width: 110 }}
                    />
                    –
                    <input
                      type="time"
                      aria-label={`${DAY_LABELS[day]} closes`}
                      value={range[1]}
                      onChange={(e) => setHours((prev) => ({ ...prev, [day]: [prev[day]?.[0] ?? '09:00', e.target.value] }))}
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
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 18 }}>Announcement bar</h2>
        <p className="hint" style={{ marginTop: 0 }}>
          A short promo line shown at the very top of your store site. Leave empty to hide.
        </p>
        <div className="field">
          <input
            type="text"
            value={announcement}
            onChange={(e) => setAnnouncement(e.target.value)}
            maxLength={140}
            placeholder="Free delivery in Lekki this week! 🎉"
          />
        </div>
        <h2 style={{ fontSize: 18 }}>Delivery & pickup</h2>
        <div className="field">
          <textarea
            value={deliveryInfo}
            onChange={(e) => setDeliveryInfo(e.target.value)}
            maxLength={400}
            rows={3}
            placeholder="We deliver across Lagos Mainland — ₦1,500 flat. Pickup at our Lekki shop Mon–Sat, 9am–6pm."
          />
          <p className="hint">Areas, fees and pickup options — shown in your store&apos;s contact section.</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 18 }}>Dropshipper</h2>
        <p className="hint" style={{ marginTop: 0 }}>
          Sell products that ship from a supplier (local or abroad)? Turn this on to get a
          verified <strong>Dropshipper</strong> tag on your store and marketplace cards, plus a
          dedicated shipping-times card on your store site.
        </p>
        <div className="field">
          <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={isDropshipper}
              onChange={(e) => setIsDropshipper(e.target.checked)}
              style={{ width: 'auto' }}
            />
            I'm a dropshipper
          </label>
        </div>
        {isDropshipper && (
          <div className="field">
            <label htmlFor="dropship">Supplier base &amp; shipping times</label>
            <textarea
              id="dropship"
              value={dropshipInfo}
              onChange={(e) => setDropshipInfo(e.target.value)}
              maxLength={400}
              rows={3}
              placeholder="Orders ship from our Lagos fulfilment partner in 1–2 days; international items arrive in 7–14 days. Tracking sent on WhatsApp."
            />
            <p className="hint">Be upfront about delivery windows — it builds trust and reduces refund requests.</p>
          </div>
        )}
      </div>

      <div className="card">
        <h2 style={{ fontSize: 18 }}>WhatsApp</h2>
        <div className="field">
          <label htmlFor="wa">WhatsApp business number</label>
          <input id="wa" type="tel" value={whatsappNumber} onChange={(e) => setWhatsappNumber(e.target.value)} placeholder="+2348012345678" />
          <p className="hint">Customers see a "Chat on WhatsApp" button with a pre-filled message — not a bot.</p>
        </div>
        <div className="field">
          <label htmlFor="greet">Pre-filled greeting (optional)</label>
          <textarea id="greet" value={greeting} onChange={(e) => setGreeting(e.target.value)} maxLength={300} placeholder="Hello! I found your store on Naijavend and I'm interested in…" />
        </div>
        <div className="field">
          <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="checkbox" checked={catalog} onChange={(e) => setCatalog(e.target.checked)} style={{ width: 'auto' }} />
            Show WhatsApp catalog link on my store page
          </label>
        </div>
      </div>

      <button className="btn btn-primary" type="submit" disabled={busy} style={{ marginTop: 16 }}>
        {busy ? 'Saving…' : 'Save settings'}
      </button>
    </form>
  );
}
