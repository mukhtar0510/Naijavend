// Natural-language search query parsing — turns
//   "cheap gift for my mum under 15k in Lagos"
// into
//   { terms: ['gift'], budgetKobo: 1_500_000, city: 'Lagos' }
// and runs it through the SAME keyword recall the plain keyword search uses.
// Deterministic on purpose: this works in every deployment with no model key,
// while the pgvector layer (see migration 20261017) adds semantic recall for
// embeddings that exist.
import { STORE_CATEGORIES } from '@idevtenancy/shared';

export interface ParsedQuery {
  /** Meaningful words, longest/most specific first, max 4. */
  terms: string[];
  /** Max price in kobo when the query named a budget. */
  budgetKobo: number | null;
  /** Lower-cased Nigerian city/place when the query named one. */
  city: string | null;
  /** STORE_CATEGORIES slug inferred from the words used. */
  category: string | null;
  kind: 'product' | 'service' | 'digital' | null;
  /** What we understood, for the "showing results for …" chips. */
  notes: string[];
}

/** Words that carry no product meaning (English + everyday Naija Pidgin). */
const STOPWORDS = new Set([
  'i', 'me', 'my', 'mine', 'we', 'our', 'us', 'you', 'your', 'he', 'she', 'they', 'them',
  'a', 'an', 'the', 'this', 'that', 'these', 'those', 'is', 'are', 'am', 'be', 'been', 'was', 'were',
  'do', 'does', 'did', 'have', 'has', 'had', 'will', 'would', 'can', 'could', 'should', 'shall',
  'for', 'of', 'to', 'in', 'on', 'at', 'by', 'with', 'from', 'and', 'or', 'but', 'so', 'as',
  'want', 'needs', 'need', 'get', 'buy', 'bought', 'looking', 'look', 'find', 'please', 'show',
  'something', 'anything', 'one', 'ones', 'thing', 'things', 'somewhere',
  // Pidgin glue words that carry no meaning on their own
  'dey', 'wetin', 'which', 'wha', 'abi', 'na', 'naa', 'ney', 'go', 'sef', 'don', 'donate',
  'abeg', 'biko', 'no', 'yes', 'well', 'wahala', 'e', 'em', 'dis', 'dat', 'dem', 'fit', 'yor',
  'under', 'below', 'within', 'over', 'more', 'less', 'cheap', 'cheapest', 'nice', 'good', 'best',
]);

/** Category keywords — a subset of the marketplace's category vocabulary. */
const CATEGORY_KEYWORDS: Array<{ category: string; words: string[] }> = [
  { category: 'beauty', words: ['braids', 'wig', 'wigs', 'hair', 'salon', 'makeup', 'gel', 'nails', 'spa', 'barbing', 'barber', 'gele'] },
  { category: 'fashion', words: ['ankara', 'agbada', 'sensor', 'aso', 'ebi', 'gele', 'clothes', 'shirt', 'trouser', 'dress', 'shoes', 'sneakers', 'bag', 'bags', 'fabric', 'tailor', 'fashion'] },
  { category: 'food', words: ['cake', 'cakes', 'chops', 'chicken', 'jollof', 'soup', 'pasta', 'snack', 'snacks', 'catering', 'bread', 'meat', 'pizza', 'grill'] },
  { category: 'groceries', words: ['rice', 'garri', 'beans', 'palm', 'oil', 'yam', 'flour', 'spice', 'grocery', 'groceries', 'provision'] },
  { category: 'electronics', words: ['phone', 'laptop', 'charger', 'headphone', 'tv', 'generator', 'appliance'] },
  { category: 'crafts', words: ['crochet', 'knitting', 'beads', 'candle', 'soap', 'handmade', 'resin'] },
  { category: 'home-services', words: ['repair', 'plumber', 'electrician', 'technician', 'cleaning'] },
  { category: 'events', words: ['photographer', 'dj', 'event', 'decor', 'rental', 'mc', 'canopy'] },
  { category: 'home-services', words: ['tutoring', 'lesson', 'lessons', 'school'] }, // no dedicated education filter on listings; service match still works
  { category: 'digital-products', words: ['ebook', 'template', 'course', 'download', 'presets'] },
];

const CITIES = [
  'lagos', 'abuja', 'portharcourt', 'port harcourt', 'ibadan', 'kano', 'enugu', 'benin', 'jos',
  'kaduna', 'calabar', 'warri', 'abeokuta', 'sokoto', 'maiduguri', 'owerri', 'uyo', 'akure',
  'asaba', 'ilorin', 'osogbo', 'ado-ekiti', 'aba', 'nnewi', 'onitsha', 'yaba', 'surulere',
  'ikeja', 'lekki', 'ajah', 'festac', 'gbagada', 'ijebu', 'oms', 'bayelsa', 'anambra', 'oyo',
  'ogun', 'kogi', 'delta', 'edo', 'akwa', 'ibom', 'crossriver', 'plateau', 'katsina', 'bauchi',
];

/** Word-level synonyms so Pidgin phrasing maps onto catalogue vocabulary. */
const SYNONYMS: Record<string, string> = {
  cloth: 'clothes',
  shoe: 'shoes',
  bag: 'bags',
  usr: 'shoes',
  wig: 'wigs',
  chrismas: 'christmas',
  barbing: 'haircut',
};

export function parseSearchQuery(raw: string): ParsedQuery {
  const query = (raw ?? '').trim().slice(0, 120);
  const lower = query.toLowerCase();
  const notes: string[] = [];

  // --- budget -------------------------------------------------------------
  let budgetNaira: number | null = null;
  const kMatch = lower.match(/(\d+(?:\.\d+)?)\s*k\b/);
  const plainMatch = lower.match(/(?:₦|n)\s?(\d{4,8})/) ?? lower.match(/\b(\d{4,8})\b/);
  if (kMatch) {
    const v = Number(kMatch[1]);
    if (v > 0 && v <= 10000) budgetNaira = Math.round(v * 1000);
  } else if (plainMatch) {
    const v = Number(plainMatch[1]);
    if (v >= 1000 && v <= 100_000_000) budgetNaira = v;
  }
  if (budgetNaira) notes.push(`under ₦${budgetNaira.toLocaleString('en-NG')}`);

  // --- city ---------------------------------------------------------------
  let city: string | null = null;
  for (const c of CITIES) {
    if (new RegExp(`\\b${c}\\b`).test(lower)) {
      city = c;
      break;
    }
  }
  if (city) notes.push(city.split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' '));

  // --- category -----------------------------------------------------------
  let category: string | null = null;
  let bestHits = 0;
  for (const rule of CATEGORY_KEYWORDS) {
    const hits = rule.words.filter((w) => new RegExp(`\\b${w}\\b`).test(lower)).length;
    if (hits > bestHits) {
      bestHits = hits;
      category = rule.category;
    }
  }
  if (category) notes.push(category.replace('-', ' '));

  // --- kind ---------------------------------------------------------------
  let kind: ParsedQuery['kind'] = null;
  if (/\b(appointment|book|booking|session|class|tutorial)\b/.test(lower)) kind = 'service';
  else if (/\b(ebook|download|digital|pdf|template)\b/.test(lower)) kind = 'digital';

  // --- keywords -----------------------------------------------------------
  const stemmed = query
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => SYNONYMS[w] ?? w)
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w) && !/^\d+$/.test(w));

  const terms = [...new Set(stemmed)].slice(0, 4);

  return { terms, budgetKobo: budgetNaira ? budgetNaira * 100 : null, city, category, kind, notes };
}