// Custom-domain helpers shared by the API and the edge middleware. Edge-safe:
// no Node APIs.

/** Hosts that are Kwaravend itself, never a store's custom domain. */
export function isPlatformHost(host: string): boolean {
  const h = host.toLowerCase().replace(/:\d+$/, '');
  return (
    h === 'kwaravend.ng' ||
    h.endsWith('.kwaravend.ng') ||
    h.endsWith('.vercel.app') ||
    h === 'localhost' ||
    h.endsWith('.localhost') ||
    h === '127.0.0.1' ||
    h === '[::1]' ||
    h.endsWith('.test')
  );
}

const DOMAIN_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;

/** "https://www.MyShop.com/" -> "www.myshop.com"; null if it isn't a domain. */
export function normaliseDomain(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const d = input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/:\d+$/, '')
    .replace(/\.$/, '');
  if (d.length < 4 || d.length > 253 || !DOMAIN_RE.test(d)) return null;
  const tld = d.split('.').pop() ?? '';
  if (/^\d+$/.test(tld)) return null; // IP addresses
  return d;
}

/** DNS records a seller sets at their registrar (Vercel's documented targets). */
export function dnsRecordsFor(domain: string): Array<{ type: string; name: string; value: string }> {
  const parts = domain.split('.');
  const apex = parts.length === 2 || (parts.length === 3 && /^(com|org|net|gov|edu)\.ng$/.test(parts.slice(1).join('.')));
  return apex
    ? [{ type: 'A', name: '@', value: '76.76.21.21' }]
    : [{ type: 'CNAME', name: parts[0]!, value: 'cname.vercel-dns.com' }];
}
