'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  Ban,
  CheckCircle2,
  LayoutDashboard,
  RefreshCw,
  ScrollText,
  Search,
  ShieldCheck,
  Store as StoreIcon,
  Trash2,
  Users,
} from 'lucide-react';
import { formatNaira } from '@idevtenancy/shared';
import { ThemeToggleCompact } from '@/components/ThemeToggleCompact';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog } from '@/components/ui/dialog';

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

interface StoreRow {
  id: string;
  name: string;
  slug: string;
  category: string | null;
  plan: string | null;
  verified: boolean;
  createdAt: string;
  ownerEmail: string | null;
  listingCount: number;
}

interface AuditEntry {
  id: number;
  actor_email: string;
  action: string;
  target_email: string | null;
  target_user_id: string | null;
  created_at: string;
}

interface DailyPoint {
  day: string;
  new_accounts: number;
  new_stores: number;
  paid_orders: number;
  revenue_kobo: number;
}

interface Analytics {
  daily: DailyPoint[];
  totals: { newAccounts: number; newStores: number; paidOrders: number; revenueKobo: number };
  topStores: Array<{ id: string; name: string; slug: string; revenueKobo: number; orders: number }>;
}

const SECTIONS = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard },
  { key: 'accounts', label: 'Accounts', icon: Users },
  { key: 'stores', label: 'Stores', icon: StoreIcon },
  { key: 'audit', label: 'Audit log', icon: ScrollText },
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

function dayLabel(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' });
}

/** Small revenue/order trend built from the daily view — no chart library. */
function TrendBars({ data }: { data: DailyPoint[] }) {
  const values = data.map((d) => Number(d.revenue_kobo ?? 0));
  const max = Math.max(1, ...values);
  if (!data.length) return <p className="!m-0 text-[13px] text-muted-foreground">No activity recorded yet.</p>;
  return (
    <div>
      <div className="flex h-32 items-end gap-1" role="img" aria-label="Daily paid revenue for the last 30 days">
        {data.map((d) => {
          const value = Number(d.revenue_kobo ?? 0);
          return (
            <div
              key={d.day}
              className={`flex-1 rounded-t-sm ${value === 0 ? 'bg-border' : 'bg-primary/80'}`}
              style={{ height: `${Math.max(3, (value / max) * 100)}%` }}
              title={`${dayLabel(d.day)}: ${formatNaira(value)} · ${d.paid_orders} order${Number(d.paid_orders) === 1 ? '' : 's'}`}
            />
          );
        })}
      </div>
      <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
        <span>{dayLabel(data[0].day)}</span>
        <span>{dayLabel(data[data.length - 1].day)}</span>
      </div>
    </div>
  );
}

export function AdminConsole({ adminEmail }: { adminEmail: string }) {
  const [section, setSection] = useState<SectionKey>('overview');
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [q, setQ] = useState('');
  const [storeQ, setStoreQ] = useState('');
  const [role, setRole] = useState<'all' | 'seller' | 'customer'>('all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<UserRow | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [notice, setNotice] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [m, u, a, an, s] = await Promise.all([
        fetch('/api/admin/metrics').then((r) => r.json()),
        fetch(`/api/admin/users?q=${encodeURIComponent(q)}&role=${role}`).then((r) => r.json()),
        fetch('/api/admin/audit').then((r) => r.json()),
        fetch('/api/admin/analytics').then((r) => r.json()),
        fetch(`/api/admin/stores?q=${encodeURIComponent(storeQ)}`).then((r) => r.json()),
      ]);
      // apiOk unwraps to the payload itself on success; error shapes carry {error}.
      if (m && !m.error) setMetrics(m.data ?? m);
      if (u && !u.error) setUsers((u.data?.users ?? u.users) ?? []);
      if (a && !a.error) setAuditLog((a.data?.entries ?? a.entries) ?? []);
      if (an && !an.error) setAnalytics(an.data ?? an);
      if (s && !s.error) setStores((s.data?.stores ?? s.stores) ?? []);
      const failure = [m, u, a, an, s].find((res) => res?.error);
      if (failure) setNotice({ kind: 'err', msg: failure.error?.message ?? 'Some admin data failed to load.' });
    } catch {
      setNotice({ kind: 'err', msg: 'Could not reach the admin API.' });
    } finally {
      setLoading(false);
    }
  }, [q, role, storeQ]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredStores = useMemo(() => {
    const needle = storeQ.trim().toLowerCase();
    if (!needle) return stores;
    return stores.filter((s) => s.name.toLowerCase().includes(needle) || s.slug.toLowerCase().includes(needle));
  }, [stores, storeQ]);

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

  const activeSection = SECTIONS.find((s) => s.key === section)!;

  return (
    <div className="admin-shell">
      {/* Top navbar: brand + identity + refresh */}
      <header className="admin-topbar">
        <div className="admin-topbar-brand">
          <span className="admin-topbar-logo">Kwara<span>vend</span></span>
          <span className="admin-topbar-divider" aria-hidden />
          <span className="admin-topbar-title">Control</span>
        </div>
        <div className="admin-topbar-actions">
          <span className="admin-topbar-identity" title={adminEmail}>{adminEmail}</span>
          <ThemeToggleCompact />
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </header>

      <div className="admin-body">
        {/* Sidebar: section switcher (horizontal scroll on phones) */}
        <aside className="admin-sidebar">
          <nav className="admin-sidebar-nav" aria-label="Admin sections">
            {SECTIONS.map((s) => {
              const Icon = s.icon;
              return (
                <button
                  key={s.key}
                  type="button"
                  className={`admin-sidebar-link ${section === s.key ? 'is-active' : ''}`}
                  aria-current={section === s.key ? 'page' : undefined}
                  onClick={() => setSection(s.key)}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden />
                  {s.label}
                </button>
              );
            })}
          </nav>
          <div className="admin-sidebar-foot">Superadmin</div>
        </aside>

        <main className="admin-main">
          {notice && (
            <div className={`alert ${notice.kind === 'ok' ? 'alert-success' : 'alert-error'}`} role="status">
              {notice.msg}
            </div>
          )}

          <div className="admin-section-head">
            <h2>{activeSection.label}</h2>
            <p className="admin-section-sub">
              {section === 'overview' && 'Platform health at a glance.'}
              {section === 'accounts' && `${users.length} shown — search, ban or delete.`}
              {section === 'stores' && `${filteredStores.length} storefronts — newest first.`}
              {section === 'audit' && 'Every admin action, newest first.'}
            </p>
          </div>

          {section === 'overview' && (
            <section aria-label="Platform metrics" className="grid gap-4">
              {/* 30-day highlights — aggregated in Postgres */}
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {[
                  { label: 'GMV (30d)', value: analytics ? formatNaira(analytics.totals.revenueKobo) : null, hint: 'paid + fulfilled' },
                  { label: 'Paid orders (30d)', value: analytics?.totals.paidOrders, hint: 'all stores' },
                  { label: 'New accounts (30d)', value: analytics?.totals.newAccounts, hint: 'signups' },
                  { label: 'New stores (30d)', value: analytics?.totals.newStores, hint: 'storefronts opened' },
                ].map((card) => (
                  <Card key={card.label}>
                    <CardHeader className="pb-1">
                      <CardDescription>{card.label}</CardDescription>
                      {card.value === null || card.value === undefined ? (
                        <Skeleton className="h-7 w-24" />
                      ) : (
                        <CardTitle className="font-mono text-xl">{card.value}</CardTitle>
                      )}
                      <span className="text-[11px] text-muted-foreground">{card.hint}</span>
                    </CardHeader>
                  </Card>
                ))}
              </div>

              <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-primary" aria-hidden /> Revenue — last 30 days
                    </CardTitle>
                    <CardDescription>Paid and fulfilled orders, by day.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {analytics ? <TrendBars data={analytics.daily} /> : <Skeleton className="h-32 w-full" />}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Top stores by revenue (30d)</CardTitle>
                    <CardDescription>Where the marketplace is actually selling.</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {!analytics ? (
                      <div className="grid gap-2">
                        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
                      </div>
                    ) : analytics.topStores.length === 0 ? (
                      <p className="!m-0 text-[13px] text-muted-foreground">No paid orders in the last 30 days.</p>
                    ) : (
                      <ul className="m-0 grid list-none gap-0 p-0">
                        {analytics.topStores.map((s, i) => (
                          <li key={s.id} className="flex items-center justify-between gap-3 py-2 text-[13.5px]">
                            <span className="flex min-w-0 items-center gap-2">
                              <span className="font-mono text-[11px] text-muted-foreground">{i + 1}</span>
                              <a href={`/s/${s.slug}`} className="truncate font-semibold">{s.name}</a>
                            </span>
                            <span className="whitespace-nowrap font-mono text-[12.5px]">{formatNaira(s.revenueKobo)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>
              </div>

              <Separator />

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
                  : Array.from({ length: 9 }).map((_, i) => <Skeleton key={i} className="h-[92px] rounded-lg" />)}
              </div>
            </section>
          )}

          {section === 'accounts' && (
            <section className="admin-users" aria-label="Accounts directory">
              <div className="admin-filters">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
                  <Input
                    type="search"
                    placeholder="Search by email…"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    aria-label="Search users by email"
                    className="pl-8"
                  />
                </div>
                <Tabs value={role} onValueChange={(next) => setRole(next as typeof role)}>
                  <TabsList>
                    <TabsTrigger value="all">All</TabsTrigger>
                    <TabsTrigger value="seller">Sellers</TabsTrigger>
                    <TabsTrigger value="customer">Customers</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              <div className="admin-table-wrap">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Activity</TableHead>
                      <TableHead>Last seen</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((u) => (
                      <TableRow key={u.id} className={u.banned ? 'is-banned' : undefined}>
                        <TableCell>
                          <span className="admin-user-email">{u.email ?? u.id.slice(0, 8)}</span>
                          {u.store_name && (
                            <a className="admin-user-store" href={`/s/${u.store_slug}`}>{u.store_name}</a>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={u.role === 'seller' ? 'default' : 'secondary'}>{u.role}</Badge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {u.role === 'seller' ? '—' : `${u.order_count} orders`}
                          {u.review_count > 0 && ` · ${u.review_count} reviews`}
                        </TableCell>
                        <TableCell>{timeAgo(u.last_sign_in_at)}</TableCell>
                        <TableCell>
                          {u.banned ? (
                            <Badge variant="destructive" title={u.ban_reason ?? undefined}>Banned</Badge>
                          ) : (
                            <Badge variant="success">Active</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1.5">
                            {u.banned ? (
                              <Button variant="outline" size="sm" disabled={busyId === u.id} onClick={() => act(u, 'unban')}>
                                <CheckCircle2 className="h-3.5 w-3.5" /> Unban
                              </Button>
                            ) : (
                              <Button variant="outline" size="sm" disabled={busyId === u.id} onClick={() => act(u, 'ban')}>
                                <Ban className="h-3.5 w-3.5" /> Ban
                              </Button>
                            )}
                            {!u.banned && (
                              <Button
                                variant="destructive"
                                size="sm"
                                disabled={busyId === u.id}
                                onClick={() => {
                                  setConfirmDelete(u);
                                  setConfirmText('');
                                }}
                              >
                                <Trash2 className="h-3.5 w-3.5" /> Delete
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {users.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                          {loading ? 'Loading accounts…' : 'No accounts match.'}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </section>
          )}

          {section === 'stores' && (
            <section className="admin-users" aria-label="Stores directory">
              <div className="admin-filters">
                <div className="relative max-w-xs flex-1">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
                  <Input
                    type="search"
                    placeholder="Search stores by name…"
                    value={storeQ}
                    onChange={(e) => setStoreQ(e.target.value)}
                    aria-label="Search stores by name"
                    className="pl-8"
                  />
                </div>
              </div>

              <div className="admin-table-wrap">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Store</TableHead>
                      <TableHead>Owner</TableHead>
                      <TableHead>Listings</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Opened</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStores.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell>
                          <a href={`/s/${s.slug}`} className="font-semibold">{s.name}</a>
                          <span className="block text-[12px] text-muted-foreground">/{s.slug}{s.category ? ` · ${s.category}` : ''}</span>
                        </TableCell>
                        <TableCell className="max-w-[220px] truncate text-[13px] text-muted-foreground">
                          {s.ownerEmail ?? '—'}
                        </TableCell>
                        <TableCell className="font-mono text-[13px]">{s.listingCount}</TableCell>
                        <TableCell><Badge variant="outline">{s.plan ?? 'free'}</Badge></TableCell>
                        <TableCell>
                          {s.verified ? (
                            <Badge variant="success"><ShieldCheck className="h-3 w-3" /> Verified</Badge>
                          ) : (
                            <Badge variant="outline">Unverified</Badge>
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground">{timeAgo(s.createdAt)}</TableCell>
                      </TableRow>
                    ))}
                    {filteredStores.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                          {loading ? 'Loading stores…' : 'No stores match.'}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </section>
          )}

          {section === 'audit' && (
            <section className="admin-audit" aria-label="Audit log">
              {auditLog.length === 0 ? (
                <p className="text-[13.5px] text-muted-foreground">No admin actions recorded yet.</p>
              ) : (
                <ul>
                  {auditLog.map((e) => (
                    <li key={e.id}>
                      <Badge variant={e.action === 'delete' ? 'destructive' : e.action === 'ban' ? 'secondary' : 'success'}>
                        {e.action}
                      </Badge>
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
      <Dialog
        open={Boolean(confirmDelete)}
        onOpenChange={(open) => {
          if (!open) setConfirmDelete(null);
        }}
        title="Delete account permanently?"
        description={
          confirmDelete ? (
            <>
              This removes <strong>{confirmDelete.email}</strong>
              {confirmDelete.role === 'seller' && confirmDelete.store_name ? (
                <> and their store <strong>{confirmDelete.store_name}</strong> with all listings, orders and reviews</>
              ) : (
                <> and all their orders and reviews</>
              )}
              . This cannot be undone.
            </>
          ) : null
        }
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={confirmText !== 'DELETE' || busyId === confirmDelete?.id}
              onClick={() => confirmDelete && act(confirmDelete, 'delete')}
            >
              {busyId === confirmDelete?.id ? 'Deleting…' : 'Delete forever'}
            </Button>
          </>
        }
      >
        <label htmlFor="confirm-input" className="block text-[13px] font-semibold">
          Type <strong>DELETE</strong> to confirm
        </label>
        <Input
          id="confirm-input"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder="DELETE"
          autoComplete="off"
          className="mt-1.5"
        />
      </Dialog>
    </div>
  );
}
