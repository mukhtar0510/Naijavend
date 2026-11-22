'use client';

// Custom domain card (Emirates Plus). Save a domain, copy the DNS record,
// wait for Kwaravend to connect it.
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Copy, Globe, Trash2 } from 'lucide-react';

export interface DomainState {
  domain: string;
  status: 'pending' | 'active' | 'failed';
  note: string;
  records: Array<{ type: string; name: string; value: string }>;
}

export function DomainCard({ initial, storeSlug }: { initial: DomainState | null; storeSlug: string }) {
  const router = useRouter();
  const [value, setValue] = useState(initial?.domain ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  async function post(body: Record<string, unknown>) {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch('/api/dashboard/domain', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const j = (await res.json()) as { error?: { message?: string } };
      if (!res.ok) throw new Error(j.error?.message ?? 'Could not save.');
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function copy(v: string) {
    try {
      await navigator.clipboard.writeText(v);
      setCopied(v);
      window.setTimeout(() => setCopied(null), 1500);
    } catch {
      /* blocked */
    }
  }

  return (
    <div className="card" style={{ display: 'grid', gap: 12, marginTop: 16 }}>
      <div>
        <h3 style={{ margin: 0, fontSize: 15, display: 'flex', gap: 8, alignItems: 'center' }}>
          <Globe size={16} aria-hidden /> Your own domain
        </h3>
        <p className="muted" style={{ margin: '4px 0 0', fontSize: 13 }}>
          Buyers can reach your store at your own address, for example myshop.com. Your kwaravend.ng/s/{storeSlug} link keeps working.
        </p>
      </div>
      <form
        style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}
        onSubmit={(e) => {
          e.preventDefault();
          void post({ domain: value });
        }}
      >
        <input className="input" style={{ flex: '1 1 220px' }} value={value} onChange={(e) => setValue(e.target.value)} placeholder="myshop.com" aria-label="Domain" required />
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {initial ? 'Change domain' : 'Connect domain'}
        </button>
      </form>
      {err && (
        <p role="alert" style={{ margin: 0, color: 'var(--danger)' }}>
          {err}
        </p>
      )}
      {initial && (
        <div style={{ display: 'grid', gap: 8 }}>
          <p style={{ margin: 0, fontSize: 14 }}>
            <strong>{initial.domain}</strong>{' '}
            {initial.status === 'active' ? (
              <span className="badge badge-success">Live</span>
            ) : initial.status === 'failed' ? (
              <span className="badge badge-danger">Needs attention</span>
            ) : (
              <span className="badge badge-warning">Waiting to connect</span>
            )}
          </p>
          {initial.note && <p className="muted" style={{ margin: 0, fontSize: 13 }}>Kwaravend: {initial.note}</p>}
          {initial.status !== 'active' && (
            <>
              <p className="muted" style={{ margin: 0, fontSize: 13 }}>
                Add this record where you bought the domain, then wait. We connect it and switch it on, usually within a day.
              </p>
              <table className="table" style={{ fontSize: 13 }}>
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Name</th>
                    <th>Value</th>
                  </tr>
                </thead>
                <tbody>
                  {initial.records.map((r) => (
                    <tr key={r.type + r.name}>
                      <td className="mono">{r.type}</td>
                      <td className="mono">{r.name}</td>
                      <td>
                        <span className="mono">{r.value}</span>{' '}
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => copy(r.value)}>
                          <Copy size={13} aria-hidden /> {copied === r.value ? 'Copied' : 'Copy'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
          <button type="button" className="btn btn-ghost btn-sm" style={{ justifySelf: 'start' }} disabled={busy} onClick={() => window.confirm('Remove this domain from your store?') && post({ action: 'remove' })}>
            <Trash2 size={14} aria-hidden /> Remove domain
          </button>
        </div>
      )}
    </div>
  );
}
