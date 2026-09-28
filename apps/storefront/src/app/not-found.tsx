import Link from 'next/link';

// Root 404 — on this Next version, every unmatched URL resolves HERE (root
// boundary), including typos under /s/*. The root layout loads the full design
// system, so the branded card styles apply. Group-level not-found files catch
// notFound() thrown from matched pages.
export default function RootNotFound() {
  return (
    <div className="notfound">
      <div className="notfound-card">
        <span className="notfound-code">404</span>
        <h1>This page wandered off</h1>
        <p>
          The link may be broken, or the store you&apos;re looking for might have
          changed its address. Try discovering something new instead.
        </p>
        <div className="notfound-actions">
          <Link href="/" className="btn btn-black">Go home</Link>
          <Link href="/discover" className="btn btn-outline">Discover stores</Link>
          <Link href="/search" className="btn btn-outline">Search</Link>
        </div>
      </div>
    </div>
  );
}
