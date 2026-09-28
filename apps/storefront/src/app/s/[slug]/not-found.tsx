import Link from 'next/link';

// Store-site 404: renders inside the seller's own masthead/footer shell, so
// shoppers never leave the store they were browsing.
export default function StoreNotFound() {
  return (
    <div className="container notfound">
      <div className="notfound-card">
        <span className="notfound-code">404</span>
        <h1>Page not found on this store</h1>
        <p>
          This listing or page may have been removed. Browse the store&apos;s
          catalogue to find something similar.
        </p>
        <div className="notfound-actions">
          <Link href="/discover" className="btn btn-outline">Discover other stores</Link>
        </div>
      </div>
    </div>
  );
}
