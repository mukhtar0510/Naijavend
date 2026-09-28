// Dashboard loading skeleton — sellers get instant feedback on nav clicks.
export default function DashboardLoading() {
  return (
    <div className="container" style={{ padding: '8px 20px 40px' }} aria-busy="true" aria-label="Loading">
      <div className="skel skel-line w-25" />
      <div className="skel-grid skel-grid-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skel skel-stat" />
        ))}
      </div>
      <div className="skel skel-card skel-card-wide" />
      <div className="skel skel-card skel-card-wide" />
    </div>
  );
}
