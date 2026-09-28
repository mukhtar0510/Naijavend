import Link from 'next/link';

// Marketplace 404: friendly, on-brand, with ways forward. Store pages (/s/*)
// have their own not-found inside their shell.
export default function NotFound() {
  return (
    <div className="container notfound">
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
