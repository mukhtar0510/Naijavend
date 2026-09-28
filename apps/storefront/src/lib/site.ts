// Canonical site origin for SEO surfaces (sitemap, robots, OG images, JSON-LD).
// Set NEXT_PUBLIC_SITE_URL in production; falls back to localhost for dev.
export function siteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  return raw.replace(/\/+$/, '');
}

// Map a store category to the most specific schema.org LocalBusiness type available.
export function schemaTypeForCategory(category: string): string {
  const map: Record<string, string> = {
    beauty: 'BeautySalon',
    food: 'Restaurant',
    groceries: 'GroceryStore',
    kitchen: 'HomeGoodsStore',
    crafts: 'Store',
    fitness: 'ExerciseGym',
    electronics: 'ElectronicsStore',
    fashion: 'ClothingStore',
    education: 'EducationalOrganization',
    'home-services': 'HomeAndConstructionBusiness',
    dropshippers: 'OnlineStore',
    // Tech & digital
    software: 'SoftwareApplication',
    'digital-products': 'OnlineStore',
    gaming: 'GameStore',
    marketing: 'AdvertisingAgency',
    // People & lifestyle
    'health-wellness': 'HealthAndBeautyBusiness',
    'baby-kids': 'BabyStore',
    pets: 'PetStore',
    jewelry: 'JewelryStore',
    // Creative & events
    photography: 'PhotographyBusiness',
    music: 'MusicVenue',
    art: 'ArtGallery',
    events: 'EventVenue',
    // Trade & industry
    auto: 'AutoPartsStore',
    agriculture: 'Farm',
    'real-estate': 'RealEstateAgent',
    'professional-services': 'ProfessionalService',
    logistics: 'MovingCompany',
    printing: 'PrintShop',
    furniture: 'FurnitureStore',
    laundry: 'DryCleaningOrLaundry',
  };
  return map[category] ?? 'LocalBusiness';
}
