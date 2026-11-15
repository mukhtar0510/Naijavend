import { redirect } from 'next/navigation';
import { getSellerClient } from '@/lib/auth';
import AboutPage from './about/page';

export const revalidate = 3600;

// The marketplace root is the brand's front door: unauthenticated visitors land
// on the About/Naijavend story, while signed-in sellers (and staff) go straight
// to their dashboard. Browsing the marketplace lives at /discover.
export default async function HomePage() {
  const sb = await getSellerClient().catch(() => null);

  if (sb) {
    return redirect('/dashboard');
  }

  return <AboutPage />;
}