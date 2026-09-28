'use client';

import { useCallback, useEffect, useState } from 'react';
import { formatNaira } from '@idevtenancy/shared';
import { ThemeToggleCompact } from '@/components/ThemeToggleCompact';

interface Metrics {
  users: number;
  stores: number;
  listings: number;
  orders: number;
  reviews: number;
  newUsers24h: number;
  newStores7d: number;
  gmvKobo: number;
  paidOrders: number;
  banned: number;
}

interface UserRow {
  id: string;
  email: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  role: string;
  store_name: string | null;
  store_slug: string | null;
  order_count: number;
  review_count: number;
  banned: boolean;
  ban_reason: string | null;
}

interface AuditEntry {
  id: number;
  actor_email: string;
  action: string;
  target_email: string | null;
  target_user_id: string | null;
  created_at: string;
}

const SECTIONS = [
  { key: 'overview', label: 'Overview', ico: '◧' },
  { key: 'accounts', label: 'Accounts', ico: '◉' },
  { key: 'audit', label: 'Audit log', ico: '≡' },
] as const;

type SectionKey = (typeof SECTIONS)[number]['key'];

const METRIC_META: Array<{ key: keyof Metrics; label: string; hint: string; money?: boolean }> = [
  { key: 'users', label: 'Total accounts', hint: 'sellers + customers' },
  { key: 'newUsers24h', label: 'New (24h)', hint: 'signups today' },
  { key: 'stores', label: 'Stores', hint: 'all storefronts' },
  { key: 'newStores7d', label: 'New stores (7d)', hint: 'this week' },
  { key: 'gmvKobo', label: 'GMV (paid)', hint: 'all paid orders', money: true },
  { key: 'paidOrders', label: 'Paid orders', hint: 'lifetime' },
  { key: 'listings', label: 'Listings', hint: 'products + services' },
  { key: 'reviews', label: 'Reviews', hint: 'all ratings' },
  { key: 'banned', label: 'Banned', hint: 'active bans' },
];

function timeAgo(iso: string | null): string {
  if (!iso) return 'never';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function AdminConsole({ adminEmail }: { adminEmail: string }) {
  const [section, setSection] = useState<SectionKey>('overview');
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [q, setQ] = useState('');
  const [role, setRole] = useState<'all' | 'seller' | 'customer'>('all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<UserRow | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [notice, setNotice] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);

  const load = useCallback(async () => {
    const [m, u, a] = await Promise.all([
      fetch('/api/admin/metrics').then((r) => r.json()),
      fetch(`/api/admin/users?q=${encodeURIComponent(q)}&role=${role}`).then((r) => r.json()),
      fetch('/api/admin/audit').then((r) => r.json()),
    ]);
    // apiOk unwraps to the payload itself on success; error shapes carry {error}.
    if (m && !m.error) setMetrics(m.data ?? m);
    if (u && !u.error) setUsers((u.data?.users ?? u.users) ?? []);
    if (a && !a.error) setAuditLog((a.data?.entries ?? a.entries) ?? []);
  }, [q, role]);

  useEffect(() => {
    load();
  }, [load]);

  async function act(user: UserRow, action: 'ban' | 'unban' | 'delete') {
    setBusyId(user.id);
    setNotice(null);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, reason: action === 'ban' ? `Banned by ${adminEmail}` : undefined }),
      });
      const body = await res.json();
      if (!res.ok || !body.ok) {
        setNotice({ kind: 'err', msg: body?.error?.message ?? 'Action failed.' });
      } else {
        setNotice({ kind: 'ok', msg: `${action} → ${user.email ?? user.id}` });
        if (action === 'delete') setConfirmDelete(null);
        await load();
      }
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="admin-shell">
      {/* Top navbar: brand + identity + refresh */}
      <header className="admin-topbar">
        <div className="admin-topbar-brand">
          <span className="admin-topbar-logo">Naija<span>vend</span></span>
          <span className="admin-topbar-divider" aria-hidden />
          <span className="admin-topbar-title">Control</span>
        </div>
        <div className="admin-topbar-actions">
          <span className="admin-topbar-identity" title={adminEmail}>{adminEmail}</span>
          <ThemeToggleCompact />
          <button type="button" className="btn btn-outline btn-sm" onClick={() => load()}>
            Refresh
          </button>
        </div>
      </header>

      <div className="admin-body">
        {/* Sidebar: section switcher (horizontal tab bar on phones) */}
        <aside className="admin-sidebar">
          <nav className="admin-sidebar-nav" aria-label="Admin sections">
            {SECTIONS.map((s) => (
              <button
                key={s.key}
                type="button"
                className={`admin-sidebar-link ${section === s.key ? 'is-active' : ''}`}
                aria-current={section === s.key ? 'page' : undefined}
                onClick={() => setSection(s.key)}
              >
                <span className="admin-sidebar-ico" aria-hidden>{s.ico}</span>
                {s.label}
              </button>
            ))}
          </nav>
          <div className="admin-sidebar-foot">Superadmin</div>
        </aside>

        {/* Active section */}
        <main className="admin-main">
          {notice && (
            <div className={`alert ${notice.kind === 'ok' ? 'alert-success' : 'alert-error'}`} role="status">
              {notice.msg}
            </div>
          )}

          {section === 'overview' && (
            <section aria-label="Platform metrics">
              <div className="admin-section-head">
                <h2>Overview</h2>
                <p className="admin-section-sub">Platform health at a glance.</p>
              </div>
              <div className="admin-metrics">
                {metrics
                  ? METRIC_META.map((m) => (
                      <div key={m.key} className="admin-metric">
                        <span className="admin-metric-value">
                          {m.money ? formatNaira(metrics[m.key]) : metrics[m.key].toLocaleString()}
                        </span>
                        <span className="admin-metric-label">{m.label}</span>
                        <span className="admin-metric-hint">{m.hint}</span>
                      </div>
                    ))
                  : Array.from({ length: 9 }).map((_, i) => <div key={i} className="admin-metric skeleton" style={{ height: 92 }} />)}
              </div>
            </section>
          )}

          {section === 'accounts' && (
            <section className="admin-users" aria-label="Accounts directory">
              <div className="admin-section-head">
                <h2>Accounts</h2>
                <p className="admin-section-sub">{users.length} shown — search, ban or delete.</p>
              </div>
              <div className="admin-filters">
                <input
                  type="search"
                  placeholder="Search by email…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  aria-label="Search users by email"
                />
                <div className="admin-role-tabs" role="tablist">
                  {(['all', 'seller', 'customer'] as const).map((r) => (
                    <button key={r} type="button" role="tab" aria-selected={role === r} className={role === r ? 'is-active' : ''} onClick={() => setRole(r)}>
                      {r === 'all' ? 'All' : r === 'seller' ? 'Sellers' : 'Customers'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Role</th>
                      <th>Activity</th>
                      <th>Last seen</th>
                      <th>Status</th>
                      <th aria-label="Actions" />
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id} className={u.banned ? 'is-banned' : ''}>
                        <td>
                          <span className="admin-user-email">{u.email ?? u.id.slice(0, 8)}</span>
                          {u.store_name && (
                            <a className="admin-user-store" href={`/s/${u.store_slug}`}>
                              {u.store_name}
                            </a>
                          )}
                        </td>
                        <td>
                          <span className={`badge ${u.role === 'seller' ? 'badge-blue' : 'badge-black'}`}>{u.role}</span>
                        </td>
                        <td className="admin-activity">
                          {u.role === 'seller' ? '—' : `${u.order_count} orders`}
                          {u.review_count > 0 && ` · ${u.review_count} reviews`}
                        </td>
                        <td>{timeAgo(u.last_sign_in_at)}</td>
                        <td>
                          {u.banned ? (
                            <span className="badge badge-danger" title={u.ban_reason ?? undefined}>
                              Banned
                            </span>
                          ) : (
                            <span className="badge badge-success">Active</span>
                          )}
                        </td>
                        <td className="admin-actions">
                          {u.banned ? (
                            <button type="button" className="btn btn-outline btn-sm" disabled={busyId === u.id} onClick={() => act(u, 'unban')}>
                              Unban
                            </button>
                          ) : (
                            <button type="button" className="btn btn-outline btn-sm" disabled={busyId === u.id} onClick={() => act(u, 'ban')}>
                              Ban
                            </button>
                          )}
                          {!u.banned && (
                            <button
                              type="button"
                              className="btn btn-sm admin-delete-btn"
                              disabled={busyId === u.id}
                              onClick={() => {
                                setConfirmDelete(u);
                                setConfirmText('');
                              }}
                            >
                              Delete
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {users.length === 0 && (
                      <tr>
                        <td colSpan={6} className="admin-empty">
                          No accounts match.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {section === 'audit' && (
            <section className="admin-audit" aria-label="Audit log">
              <div className="admin-section-head">
                <h2>Audit log</h2>
                <p className="admin-section-sub">Every admin action, newest first.</p>
              </div>
              {auditLog.length === 0 ? (
                <p className="muted">No admin actions recorded yet.</p>
              ) : (
                <ul>
                  {auditLog.map((e) => (
                    <li key={e.id}>
                      <span className={`badge ${e.action === 'delete' ? 'badge-danger' : e.action === 'ban' ? 'badge-black' : 'badge-success'}`}>{e.action}</span>
                      <strong>{e.actor_email}</strong> → {e.target_email ?? e.target_user_id}
                      <time>{timeAgo(e.created_at)}</time>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </main>
      </div>

      {/* Delete confirmation — type-to-confirm (researched destructive-action pattern) */}
      {confirmDelete && (
        <div className="admin-modal-backdrop" role="dialog" aria-modal="true" aria-label="Confirm deletion">
          <div className="admin-modal">
            <h3>Delete account permanently?</h3>
            <p>
              This removes <strong>{confirmDelete.email}</strong>
              {confirmDelete.role === 'seller' && confirmDelete.store_name ? (
                <>
                  {' '}
                  and their store <strong>{confirmDelete.store_name}</strong> with all listings, orders and reviews
                </>
              ) : (
                <> and all their orders and reviews</>
              )}
              . This cannot be undone.
            </p>
            <label htmlFor="confirm-input">
              Type <strong>DELETE</strong> to confirm
            </label>
            <input
              id="confirm-input"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="DELETE"
              autoComplete="off"
            />
            <div className="admin-modal-actions">
              <button type="button" className="btn btn-outline" onClick={() => setConfirmDelete(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn admin-delete-btn"
                disabled={confirmText !== 'DELETE' || busyId === confirmDelete.id}
                onClick={() => act(confirmDelete, 'delete')}
              >
                {busyId === confirmDelete.id ? 'Deleting…' : 'Delete forever'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
