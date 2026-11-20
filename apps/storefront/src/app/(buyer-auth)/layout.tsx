import '../../styles/marketplace-v2.css';

// Buyer sign-in/up pages use the marketplace (nv-*) components, so they import
// the marketplace stylesheet themselves now that it is no longer global.
export default function BuyerAuthLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
