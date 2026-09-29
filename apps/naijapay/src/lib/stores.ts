// Demo registry of Naijavend stores a wallet user can pay. These mirror the
// kinds of businesses on the marketplace (Amaka Glow Studio is the well-known
// demo store) but nothing here talks to the real marketplace — it's all local.

export interface NaijaStore {
  id: string;
  name: string;
  category: string;
  color: string;
  emoji: string;
  /** Typical amounts the store's checkout flow suggests. */
  quickKobo: number[];
}

export const NAIJA_STORES: NaijaStore[] = [
  {
    id: 'st-amaka',
    name: 'Amaka Glow Studio',
    category: 'Beauty · Lagos',
    color: '#be185d',
    emoji: '💅',
    quickKobo: [1500000, 3500000, 8000000], // ₦15k / ₦35k / ₦80k
  },
  {
    id: 'st-deen',
    name: 'Deen Gadgets NG',
    category: 'Electronics · Abuja',
    color: '#1d4ed8',
    emoji: '📱',
    quickKobo: [2500000, 12000000, 45000000],
  },
  {
    id: 'st-mama',
    name: "Mama Nkechi Kitchen",
    category: 'Food · Port Harcourt',
    color: '#15803d',
    emoji: '🍲',
    quickKobo: [350000, 700000, 1500000],
  },
  {
    id: 'st-tomi',
    name: 'Tomi Fits & Threads',
    category: 'Fashion · Ibadan',
    color: '#7c3aed',
    emoji: '👗',
    quickKobo: [1200000, 2500000, 6000000],
  },
  {
    id: 'st-bola',
    name: 'Bola Home Essentials',
    category: 'Home · Lagos',
    color: '#b45309',
    emoji: '🧺',
    quickKobo: [800000, 2000000, 5000000],
  },
];

export function storeById(id: string): NaijaStore | undefined {
  return NAIJA_STORES.find((s) => s.id === id);
}
