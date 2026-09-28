import { ImageResponse } from 'next/og';
import { supabaseAnon } from '@/lib/supabase';
import { schemaTypeForCategory } from '@/lib/site';

export const runtime = 'nodejs';
export const alt = 'Store storefront card';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OgImage({ params }: { params: { slug: string } }) {
  let name = 'Store';
  let category = 'general';
  let businessType = '';
  let rankLine = '';

  try {
    const sb = supabaseAnon();
    const { data: store } = await sb
      .from('stores')
      .select('name, category, business_type, store_rating_stats(overall_rank, review_count)')
      .eq('slug', params.slug)
      .maybeSingle();
    if (store) {
      name = String(store.name);
      category = String(store.category);
      businessType = String(store.business_type);
      const stats = (store.store_rating_stats as Array<{ overall_rank: number | null; review_count: number }> | null)?.[0];
      if (stats?.overall_rank && stats.review_count >= 3) {
        rankLine = `#${stats.overall_rank} ranked on Naijavend`;
      }
    }
  } catch {
    // Fall back to a generic card rather than failing the image.
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#ffffff',
          padding: 72,
          position: 'relative',
        }}
      >
        {/* Blue brand band */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: 24,
            background: '#1d4ed8',
            display: 'flex',
          }}
        />
        {/* Warm corner glow */}
        <div
          style={{
            position: 'absolute',
            right: -180,
            top: -180,
            width: 520,
            height: 520,
            borderRadius: 999,
            background: '#eaf1fe',
            display: 'flex',
          }}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              display: 'flex',
              border: '2px solid rgba(29, 78, 216, 0.35)',
              borderRadius: 999,
              padding: '8px 20px',
              background: '#eaf1fe',
            }}
          >
            <span style={{ fontSize: 26, fontWeight: 600, color: '#1d4ed8' }}>
              {category}
              {businessType ? ` · ${businessType}` : ''}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <span style={{ fontSize: 88, fontWeight: 800, color: '#0b0c0e', letterSpacing: '-0.03em' }}>
            {name}
          </span>
          <span style={{ fontSize: 34, color: '#5b6472' }}>
            {schemaTypeForCategory(category) === 'Restaurant'
              ? 'Food & dining'
              : 'Products & services'} · Nigeria
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span style={{ fontSize: 40, fontWeight: 800, color: '#0b0c0e' }}>Naija</span>
          <span style={{ fontSize: 40, fontWeight: 800, color: '#1d4ed8' }}>cart</span>
          </div>
          {rankLine ? (
            <div
              style={{
                display: 'flex',
                border: '2px solid rgba(11, 12, 14, 0.3)',
                borderRadius: 999,
                padding: '8px 24px',
                background: '#eef1f6',
              }}
            >
              <span style={{ fontSize: 26, fontWeight: 600, color: '#0b0c0e' }}>{rankLine}</span>
            </div>
          ) : null}
        </div>
      </div>
    ),
    { ...size }
  );
}
