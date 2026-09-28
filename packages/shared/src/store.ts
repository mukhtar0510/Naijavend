// Store categories — single source of truth. The `category` column on `stores`
// is free text, but every surface (onboarding, discover chips, rankings, map,
// catalogue, SEO) should agree on the canonical set. Add a new category here
// and every marketplace filter picks it up.
//
// Broad categories first, niche ones after — the picker and chips keep this order.

export const STORE_CATEGORIES = [
  // Broad
  'beauty',
  'fashion', // clothing, tailors, boutiques, aso-ebi
  'kitchen', // cookware, utensils, kitchen appliances
  'food',
  'groceries', // foodstuff, provisions, supermarkets
  'crafts', // crochet, beads, handmade
  'fitness',
  'education',
  'home-services',
  'electronics',
  'dropshippers',
  'general',

  // Tech & digital
  'software', // apps, SaaS, web development
  'digital-products', // ebooks, templates, presets, downloads
  'gaming', // consoles, games, gaming gear
  'marketing', // social media management, ads, branding agencies

  // People & lifestyle
  'health-wellness', // supplements, therapy, holistic care
  'baby-kids', // kids clothing, toys, childcare
  'pets', // pet food, accessories, grooming
  'jewelry', // fine and fashion jewellery, watches

  // Creative & events
  'photography', // photographers, videographers
  'music', // instruments, DJ services, production
  'art', // paintings, commissions, prints
  'events', // planning, rentals, decor, MCs

  // Trade & industry
  'auto', // car parts, mechanics, detailing
  'agriculture', // farm produce, seedlings, livestock
  'real-estate', // agents, property listings, shortlets
  'professional-services', // legal, accounting, consulting
  'logistics', // couriers, dispatch riders, delivery
  'printing', // printing, stationery, custom merch
  'furniture', // home & office furniture, interiors
  'laundry', // laundry & cleaning services
] as const;

export type StoreCategory = (typeof STORE_CATEGORIES)[number];

/** Human-readable label — used on chips and pickers instead of the raw slug. */
export const STORE_CATEGORY_LABELS: Record<StoreCategory, string> = {
  beauty: 'Beauty',
  fashion: 'Fashion & Clothing',
  kitchen: 'Kitchen',
  food: 'Food & Catering',
  groceries: 'Groceries',
  crafts: 'Crafts & Handmade',
  fitness: 'Fitness',
  education: 'Education',
  'home-services': 'Home Services',
  electronics: 'Electronics',
  dropshippers: 'Dropshipping',
  general: 'General',
  software: 'Software & Apps',
  'digital-products': 'Digital Products',
  gaming: 'Gaming',
  marketing: 'Marketing & Ads',
  'health-wellness': 'Health & Wellness',
  'baby-kids': 'Baby & Kids',
  pets: 'Pets',
  jewelry: 'Jewelry & Watches',
  photography: 'Photography',
  music: 'Music & DJ',
  art: 'Art',
  events: 'Events',
  auto: 'Auto',
  agriculture: 'Agriculture',
  'real-estate': 'Real Estate',
  'professional-services': 'Professional Services',
  logistics: 'Logistics',
  printing: 'Printing',
  furniture: 'Furniture',
  laundry: 'Laundry & Cleaning',
};

export function categoryLabel(category: string): string {
  return STORE_CATEGORY_LABELS[category as StoreCategory] ?? category;
}

export const STORE_CATEGORY_EMOJI: Record<StoreCategory, string> = {
  beauty: '💅',
  fashion: '👗',
  kitchen: '🍳',
  food: '🍲',
  groceries: '🛒',
  crafts: '🧶',
  fitness: '🏋️',
  education: '📚',
  'home-services': '🔧',
  electronics: '🔌',
  dropshippers: '🚚',
  general: '🛍️',
  software: '💻',
  'digital-products': '💾',
  gaming: '🎮',
  marketing: '📈',
  'health-wellness': '🌿',
  'baby-kids': '🧸',
  pets: '🐾',
  jewelry: '💍',
  photography: '📸',
  music: '🎵',
  art: '🎨',
  events: '🎉',
  auto: '🚗',
  agriculture: '🌾',
  'real-estate': '🏠',
  'professional-services': '💼',
  logistics: '🛵',
  printing: '🖨️',
  furniture: '🛋️',
  laundry: '🧺',
};

export function categoryEmoji(category: string): string {
  return STORE_CATEGORY_EMOJI[category as StoreCategory] ?? '🛍️';
}

/** Badge colour class defined in chrome.css (.cat-*). */
export const STORE_CATEGORY_CLASS: Record<StoreCategory, string> = {
  beauty: 'cat-beauty',
  fashion: 'cat-fashion',
  kitchen: 'cat-kitchen',
  food: 'cat-food',
  groceries: 'cat-groceries',
  crafts: 'cat-crafts',
  fitness: 'cat-fitness',
  education: 'cat-education',
  'home-services': 'cat-home-services',
  electronics: 'cat-electronics',
  dropshippers: 'cat-dropshippers',
  general: 'cat-general',
  software: 'cat-software',
  'digital-products': 'cat-digital-products',
  gaming: 'cat-gaming',
  marketing: 'cat-marketing',
  'health-wellness': 'cat-health-wellness',
  'baby-kids': 'cat-baby-kids',
  pets: 'cat-pets',
  jewelry: 'cat-jewelry',
  photography: 'cat-photography',
  music: 'cat-music',
  art: 'cat-art',
  events: 'cat-events',
  auto: 'cat-auto',
  agriculture: 'cat-agriculture',
  'real-estate': 'cat-real-estate',
  'professional-services': 'cat-professional-services',
  logistics: 'cat-logistics',
  printing: 'cat-printing',
  furniture: 'cat-furniture',
  laundry: 'cat-laundry',
};

export function categoryClass(category: string): string {
  return STORE_CATEGORY_CLASS[category as StoreCategory] ?? 'cat-general';
}

/** Server-boundary check for a category value. */
export function isStoreCategory(v: unknown): v is StoreCategory {
  return typeof v === 'string' && (STORE_CATEGORIES as readonly string[]).includes(v);
}
