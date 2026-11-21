// Route group for shell-less, full-screen pages (the /map page).
// Imports the base stylesheets at LAYOUT level, like the store-site layout:
// Next 14 dedupes shared CSS into other routes' chunks, and page-level imports
// alone left /map without base, component and system styles.
// Order matters: tokens → base → components → interactions → system → page.
import '../../styles/tokens.css';
import '../../styles/base.css';
import '../../styles/components.css';
import '../../styles/interactions.css';
import '../../styles/system.css';
import '../../styles/shell.css';
import '../../styles/mappage.css';

export default function FullScreenLayout({ children }: { children: React.ReactNode }) {
  return children;
}
