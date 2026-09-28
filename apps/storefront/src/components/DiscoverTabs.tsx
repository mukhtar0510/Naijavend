'use client';

import { useState } from 'react';

// Discover page tabs: the classic list (nearby list, search, store cards) and
// the full street-map view in their own tabs.
export function DiscoverTabs({
  list,
  map,
  initial = 'list',
}: {
  list: React.ReactNode;
  map: React.ReactNode;
  initial?: 'list' | 'map';
}) {
  const [tab, setTab] = useState<'list' | 'map'>(initial);

  return (
    <>
      <div className="disc-tabs" role="tablist" aria-label="Browse mode">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'list'}
          className={`disc-tab${tab === 'list' ? ' on' : ''}`}
          onClick={() => setTab('list')}
        >
          🧭 List
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'map'}
          className={`disc-tab${tab === 'map' ? ' on' : ''}`}
          onClick={() => setTab('map')}
        >
          🗺️ Map
        </button>
      </div>
      {tab === 'list' ? list : map}
    </>
  );
}
