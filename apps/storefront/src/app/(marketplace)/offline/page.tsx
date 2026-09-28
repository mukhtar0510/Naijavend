'use client';

// Full-page offline fallback, precached at service-worker install time.
// Client component: the retry button needs an onClick handler.
import { metadata } from './metadata';

export default function OfflinePage() {
  return (
    <div className="container notfound">
      <div className="notfound-card">
        <span className="notfound-glyph" aria-hidden>📡</span>
        <h1>You&apos;re offline</h1>
        <p>
          Naijavend needs a connection to load live store data. Pages you visited
          recently may still open from the offline copy — try going back or
          retrying below.
        </p>
        <div className="notfound-actions">
          <button className="btn btn-black" type="button" onClick={() => window.location.reload()}>
            Retry connection
          </button>
          <a href="/" className="btn btn-outline">Go home</a>
        </div>
      </div>
    </div>
  );
}
