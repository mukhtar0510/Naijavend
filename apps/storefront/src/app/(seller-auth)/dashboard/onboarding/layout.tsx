import { redirect } from 'next/navigation';
import { getSellerClient } from '@/lib/auth';

// The onboarding wizard renders full-screen (no dashboard chrome), but it still
// requires a seller session — guard here instead of relying on the dashboard layout.
export default async function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const sb = await getSellerClient();
  if (!sb) redirect('/dashboard/signin');
  return children;
}
