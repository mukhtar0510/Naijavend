import { cn } from '@/lib/utils';

/** Shimmering placeholder block used while admin data loads. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('animate-pulse rounded-md bg-muted', className)} />;
}
