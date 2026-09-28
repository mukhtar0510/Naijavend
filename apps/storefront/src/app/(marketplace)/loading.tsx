// Route-level skeleton: paints instantly on navigation click so the app feels
// immediate even while the server renders the real content.
export default function MarketplaceLoading() {
  return (
    <div className="container" style={{ padding: '32px 20px' }} aria-busy="true" aria-label="Loading">
      <div className="skel skel-hero" />
      <div className="skel-row">
        <div className="skel skel-line w-40" />
        <div className="skel skel-line w-25" />
        <div className="skel skel-line w-30" />
      </div>
      <div className="skel-grid">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skel skel-card" />
        ))}
      </div>
    </div>
  );
}
