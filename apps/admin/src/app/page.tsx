import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { currentAdmin } from '@/lib/admin';
import { AdminConsole } from './AdminConsole';

export const metadata: Metadata = { title: 'Control' };

// Standalone admin console — email+password session only. No session → /signin.
export default async function AdminHomePage() {
  const admin = await currentAdmin();
  if (!admin) redirect('/signin');

  return <AdminConsole adminEmail={admin.email} />;
}
