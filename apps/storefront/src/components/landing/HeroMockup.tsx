'use client';

// "/" hero product mockup (REDESIGN_V2 §5.1): an EXAMPLE storefront with
// sample data, labelled as such (honesty rule). The same SitePreview shows the
// seller's real store on the dashboard.

import { SitePreview } from '@/components/preview/SitePreview';

export function HeroMockup() {
  return (
    <SitePreview
      intro
      label="Example storefront"
      url="kwaravend.ng/s/example-store"
      name="Fate Cake Studio"
      verified
      area="Fate, Ilorin"
      open
      promo={{ title: 'Weekend cake orders are open', text: 'Order by Thursday for Saturday pickup or delivery.' }}
      products={[
        { name: 'Red velvet, 8 inch', price: '₦18,500' },
        { name: 'Chin chin, 1 kg tub', price: '₦4,200' },
        { name: 'Cupcakes, box of 6', price: '₦7,800' },
      ]}
      phone={{
        inbound: 'Hello, is the red velvet available for Saturday?',
        outbound: 'Yes. Order on the store and pick delivery to Tanke.',
      }}
      description="Example storefront with sample data"
    />
  );
}
