// Automatic hashtags for listings that have none yet.
//
// Sellers can type hashtags or let the AI suggest them, but most listings start
// with none, so buyers would never see a hashtag. These are derived from the
// listing's own title and category (nothing invented): "Jollof rice and
// chicken" in food -> #jollof #rice #chicken #food. A seller's own tags always
// win; auto tags only fill an empty list.
import { MAX_HASHTAGS, normaliseHashtag, parseHashtags } from './validation';

/** Words that say nothing about what the item is. */
const STOP = new Set([
  'and', 'the', 'for', 'with', 'from', 'your', 'our', 'you', 'all', 'any', 'per', 'one', 'two', 'three', 'four',
  'five', 'six', 'pack', 'packs', 'box', 'boxes', 'set', 'sets', 'piece', 'pieces', 'pcs', 'size', 'small',
  'medium', 'large', 'big', 'mini', 'new', 'brand', 'best', 'quality', 'original', 'inch', 'inches', 'litre',
  'litres', 'liter', 'kg', 'kgs', 'gram', 'grams', 'mah', 'bag', 'bags', 'monthly', 'weekly', 'daily', 'visit',
  'fitted', 'back', 'mid', 'only', 'each', 'free', 'sale', 'offer', 'service', 'services', 'item', 'items',
]);

const MAX_AUTO = 4;

/** Hashtags derived from a title and a store/listing category, at most 4. */
export function autoHashtags(title: unknown, category?: unknown): string[] {
  const words = (typeof title === 'string' ? title : '')
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3 && !/^\d+$/.test(w) && !STOP.has(w));
  const out: string[] = [];
  for (const w of words) {
    const t = normaliseHashtag(w);
    if (t && !out.includes(t)) out.push(t);
    if (out.length >= MAX_AUTO - 1) break;
  }
  const cat = typeof category === 'string' && category !== 'general' ? normaliseHashtag(category) : '';
  if (cat && !out.includes(cat)) out.push(cat);
  return out.slice(0, MAX_AUTO);
}

/**
 * The hashtags to show and search for a listing: its own tags when it has any,
 * otherwise the automatic ones from its title and category.
 */
export function listingHashtags(tags: unknown, title: unknown, category?: unknown): string[] {
  const own = parseHashtags(tags, MAX_HASHTAGS);
  return own.length > 0 ? own : autoHashtags(title, category);
}
