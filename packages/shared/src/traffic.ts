// Traffic-source classification for seller analytics.
//
// A raw referrer is not something to show a seller: it can be "localhost:3000"
// (their own dev browser), a deploy URL, or a bare domain. Sellers care about
// three things — did the visitor browse Naijavend itself, find the store via a
// search engine, or arrive through a shared link — so every referrer is folded
// into a small set of labels and dev/internal traffic is dropped entirely.

export type TrafficSourceKind = 'home' | 'search' | 'social' | 'link' | 'direct' | 'internal';

export interface TrafficSource {
  kind: TrafficSourceKind;
  label: string;
  /** Dev/private traffic (localhost, LAN, file://) — never shown to the seller. */
  ignore: boolean;
}

/** Social hosts we can still name, so sellers see "WhatsApp" not "Link". */
const SOCIAL_HOSTS: Record<string, string> = {
  'wa.me': 'WhatsApp',
  'api.whatsapp.com': 'WhatsApp',
  'chat.whatsapp.com': 'WhatsApp',
  'whatsapp.com': 'WhatsApp',
  'web.whatsapp.com': 'WhatsApp',
  't.co': 'X (Twitter)',
  'twitter.com': 'X (Twitter)',
  'x.com': 'X (Twitter)',
  'facebook.com': 'Facebook',
  'fb.com': 'Facebook',
  'l.facebook.com': 'Facebook',
  'm.facebook.com': 'Facebook',
  'instagram.com': 'Instagram',
  'l.instagram.com': 'Instagram',
  'tiktok.com': 'TikTok',
  'youtube.com': 'YouTube',
  'youtu.be': 'YouTube',
  't.me': 'Telegram',
  'telegram.me': 'Telegram',
  'linkedin.com': 'LinkedIn',
  'lnkd.in': 'LinkedIn',
  'pinterest.com': 'Pinterest',
  'pin.it': 'Pinterest',
  'snapchat.com': 'Snapchat',
  'reddit.com': 'Reddit',
};

/** Hosts that mean "they searched for you". */
const SEARCH_HOSTS = new Set([
  'bing.com',
  'duckduckgo.com',
  'yahoo.com',
  'yandex.com',
  'yandex.ru',
  'baidu.com',
  'ecosia.org',
  'startpage.com',
  'qwant.com',
  'ask.com',
  'brave.com',
  'naver.com',
  'search.marginalia.nu',
]);

/** Search engines that also exist per-country as google.ng, google.co.uk, … */
const SEARCH_PREFIXES = ['google.', 'search.google.'];

const LOCAL_HOST =
  /^(localhost(:\d+)?|.*\.localhost|127\.0\.0\.1|0\.0\.0\.0|\[?::1\]?|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|.*\.local|.*\.internal|.*\.test)(:\d+)?$/i;

export const SOURCE_LABELS = {
  home: 'Home page',
  search: 'Search',
  link: 'Link',
  direct: 'Direct / typed',
} as const;

/** Share-target keys sent by the storefront ShareBar. */
const SHARE_SOURCE_LABELS: Record<string, string> = {
  whatsapp: 'WhatsApp',
  x: 'X (Twitter)',
  facebook: 'Facebook',
  telegram: 'Telegram',
  native: 'the share menu',
};

function hostOf(referrer: string): string | null {
  try {
    return new URL(referrer).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return null;
  }
}

/** True for the marketplace's own hosts — production domain or a deploy URL. */
function isOwnSite(host: string, ownHosts: string[]): boolean {
  if (ownHosts.some((own) => host === own)) return true;
  // Vercel deploy URLs of this project (naijacart-roan, naijacart-<hash>-…).
  return /^naijacart(-[a-z0-9-]+)?\.vercel\.app$/i.test(host);
}

/**
 * Classify one recorded referrer/source pair into a seller-facing label.
 * `ownHosts` should contain the site's own hostname(s), without a scheme.
 */
export function classifyTrafficSource(
  referrer: string | null | undefined,
  source: string | null | undefined,
  ownHosts: string[] = []
): TrafficSource {
  // Share events carry an explicit target ("whatsapp", "x", …).
  if (source) {
    const friendly = SHARE_SOURCE_LABELS[source.toLowerCase()];
    return { kind: 'social', label: friendly ? `Shared on ${friendly}` : 'Shared', ignore: false };
  }

  const raw = (referrer ?? '').trim();
  if (!raw) return { kind: 'direct', label: SOURCE_LABELS.direct, ignore: false };

  // Guard before parsing: an unparseable string containing "localhost" is still
  // the seller's own machine and must never reach the analytics list.
  if (/localhost|127\.0\.0\.1|\[::1\]/i.test(raw)) return { kind: 'internal', label: '', ignore: true };
  if (/^file:\/\//i.test(raw)) return { kind: 'internal', label: '', ignore: true };

  // Same-site referrers are often relative ("/s/amaka") — they came from
  // another page on Naijavend, i.e. the home page, search or marketplace browse.
  if (raw.startsWith('/')) {
    return { kind: 'home', label: SOURCE_LABELS.home, ignore: false };
  }

  const host = hostOf(raw);
  if (!host) {
    // Unknown shape: treat as an external link rather than echoing raw text.
    return { kind: 'link', label: SOURCE_LABELS.link, ignore: false };
  }

  if (LOCAL_HOST.test(host)) return { kind: 'internal', label: '', ignore: true };
  if (isOwnSite(host, ownHosts)) return { kind: 'home', label: SOURCE_LABELS.home, ignore: false };

  const bare = host.replace(/^(m|l|amp|search)\./, '');
  if (SOCIAL_HOSTS[host] || SOCIAL_HOSTS[bare]) {
    return { kind: 'social', label: SOCIAL_HOSTS[host] ?? SOCIAL_HOSTS[bare], ignore: false };
  }
  if (SEARCH_HOSTS.has(bare) || SEARCH_PREFIXES.some((p) => host.startsWith(p))) {
    return { kind: 'search', label: SOURCE_LABELS.search, ignore: false };
  }

  return { kind: 'link', label: SOURCE_LABELS.link, ignore: false };
}

/** The site's own hostnames derived from a configured site URL. */
export function ownHostsFromSiteUrl(siteUrl: string): string[] {
  const host = hostOf(siteUrl) ?? hostOf(`https://${siteUrl}`);
  return host ? [host] : [];
}
