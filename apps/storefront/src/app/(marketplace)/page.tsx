import { redirect } from 'next/navigation';
import { getSellerClient } from '@/lib/auth';
import AboutPage from './about/page';

export const revalidate = 3600;

// The marketplace root is the brand's front door: unauthenticated visitors land
// on the About/Naijavend story, while signed-in sellers (and staff) go straight
// to their dashboard. The store-listing home lives at /home.
export default async function RootPage() {
  const sb = await getSellerClient().catch(() => null);

  if (sb) {
    return redirect('/dashboard');
  }

  return <AboutPage />;
}