'use client';

import { useState } from 'react';
import { Megaphone as IcMegaphone, Store as IcStore } from 'lucide-react';

/**
 * Dashboard settings tabs, styled like the discover page tabs (.disc-tabs).
 * The page was one long scroll of three unrelated forms; this splits it into
 * Business / Announcement without changing any form internals. Look & feel
 * has its own dashboard section (/dashboard/design) since 26 Nov 2026.
 */
export function SettingsTabs({
  business,
  announcement,
  initial = 'business',
}: {
  business: React.ReactNode;
  announcement: React.ReactNode;
  initial?: 'business' | 'announcement';
}) {
  const [tab, setTab] = useState<'business' | 'announcement'>(initial);

  return (
    <>
      <div className="disc-tabs" role="tablist" aria-label="Settings sections">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'business'}
          className={`disc-tab${tab === 'business' ? ' on' : ''}`}
          onClick={() => setTab('business')}
        >
          <IcStore className="ico-inline" aria-hidden /> Business
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'announcement'}
          className={`disc-tab${tab === 'announcement' ? ' on' : ''}`}
          onClick={() => setTab('announcement')}
        >
          <IcMegaphone className="ico-inline" aria-hidden /> Announcement
        </button>
      </div>
      {tab === 'business' && business}
      {tab === 'announcement' && announcement}
    </>
  );
}
