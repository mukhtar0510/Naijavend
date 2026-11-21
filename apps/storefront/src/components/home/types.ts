import type { BusinessHours } from '@idevtenancy/shared';

/** A store as /home needs it: serialisable, real data only. */
export interface HomeStore {
  id: string;
  slug: string;
  name: string;
  category: string;
  logo: string | null;
  banner: string | null;
  verified: boolean;
  isExample: boolean;
  /** Computed in the browser (Ilorin time), not on the server. */
  hours: BusinessHours | null;
  /** Nearest seeded Ilorin area to the store's pin (area level only). */
  areaId: string | null;
  areaLabel: string | null;
  reviewCount: number;
  avgStars: number;
  createdAt: string;
}
