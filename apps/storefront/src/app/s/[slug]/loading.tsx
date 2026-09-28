// Store-site loading skeleton — keeps the seller's own shell instant-feeling.
export default function StoreLoading() {
  return (
    <div className="container" style={{ padding: '28px 20px' }} aria-busy="true" aria-label="Loading">
      <div className="skel skel-banner" />
      <div className="skel-row">
        <div className="skel skel-line w-30" />
        <div className="skel skel-line w-20" />
      </div>
      <div className="skel-grid">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="skel skel-card" />
        ))}
      </div>
    </div>
  );
}
