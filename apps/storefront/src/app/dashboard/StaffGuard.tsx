'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

// Staff see a reduced dashboard. Owner-only pages are already blocked at the
// API layer (ownerGate) — this guard stops staff from landing on them in the
// first place and quietly routes them back to the POS.
export function StaffGuard({ allowed }: { allowed: string[] }) {
  const pathname = usePathname();
  const router = useRouter();

  const ok = allowed.some((a) => pathname === a || pathname.startsWith(`${a}/`));

  useEffect(() => {
    if (!ok) router.replace('/dashboard/pos');
  }, [ok, router]);

  return ok ? null : (
    <div className="container" style={{ padding: '32px 20px' }}>
      <div className="alert alert-error" role="status">
        That page is for the store owner — taking you back to the POS.
      </div>
    </div>
  );
}
