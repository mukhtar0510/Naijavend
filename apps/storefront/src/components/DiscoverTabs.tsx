'use client';

import { useState } from 'react';
import { LayoutGrid as IcGrid, List as IcList, Map as IcMap } from 'lucide-react';

export type DiscoverView = 'explore' | 'list' | 'map';

// Discover page tabs: the Explore mosaic (default), the store list (nearby
// list, store cards) and the street map, each in its own tab.
export function DiscoverTabs({
  explore,
  list,
  map,
  initial = 'explore',
}: {
  explore: React.ReactNode;
  list: React.ReactNode;
  map: React.ReactNode;
  initial?: DiscoverView;
}) {
  const [tab, setTab] = useState<DiscoverView>(initial);
  const tabs: Array<{ id: DiscoverView; label: string; Icon: typeof IcGrid }> = [
    { id: 'explore', label: 'Explore', Icon: IcGrid },
    { id: 'list', label: 'Stores', Icon: IcList },
    { id: 'map', label: 'Map', Icon: IcMap },
  ];

  return (
    <>
      <div className="disc-tabs" role="tablist" aria-label="Browse mode">
        {tabs.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={`disc-tab${tab === id ? ' on' : ''}`}
            onClick={() => {
              setTab(id);
              // Keep the view in the URL so back/refresh return to it.
              try {
                const url = new URL(window.location.href);
                if (id === 'explore') url.searchParams.delete('view');
                else url.searchParams.set('view', id);
                window.history.replaceState(window.history.state, '', url);
              } catch {
                /* ignore */
              }
            }}
          >
            <Icon className="ico-inline" aria-hidden /> {label}
          </button>
        ))}
      </div>
      {tab === 'explore' ? explore : tab === 'list' ? list : map}
    </>
  );
}
