'use client';

import { useState } from 'react';

/**
 * Dashboard settings tabs, styled like the discover page tabs (.disc-tabs).
 * The page was one long scroll of three unrelated forms; this splits it into
 * Business / Announcement / Look & feel without changing any form internals.
 */
export function SettingsTabs({
  business,
  announcement,
  appearance,
  initial = 'business',
}: {
  business: React.ReactNode;
  announcement: React.ReactNode;
  appearance: React.ReactNode;
  initial?: 'business' | 'announcement' | 'appearance';
}) {
  const [tab, setTab] = useState<'business' | 'announcement' | 'appearance'>(initial);

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
          🏪 Business
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'announcement'}
          className={`disc-tab${tab === 'announcement' ? ' on' : ''}`}
          onClick={() => setTab('announcement')}
        >
          📣 Announcement
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'appearance'}
          className={`disc-tab${tab === 'appearance' ? ' on' : ''}`}
          onClick={() => setTab('appearance')}
        >
          🎨 Look &amp; feel
        </button>
      </div>
      {tab === 'business' && business}
      {tab === 'announcement' && announcement}
      {tab === 'appearance' && appearance}
    </>
  );
}
