import { FlaskConical } from 'lucide-react';

/**
 * Honest label for sample-data stores (stores.is_example). Shown at the top
 * of every example store page so nobody mistakes it for a real business.
 * Orders and bookings are rejected server-side for these stores.
 */
export function ExampleStoreBanner() {
  return (
    <div className="example-banner" role="note">
      <FlaskConical size={18} aria-hidden />
      <p>
        <strong>Example store · Sample data.</strong> This isn&apos;t a real business. It shows what a Kwaravend store
        looks like, and it can&apos;t take orders or bookings.
      </p>
    </div>
  );
}

/** Small inline tag for cards, list rows and map pins. */
export function ExampleTag() {
  return (
    <span className="example-tag" title="Example store with sample data. It can't take orders.">
      Example
    </span>
  );
}
