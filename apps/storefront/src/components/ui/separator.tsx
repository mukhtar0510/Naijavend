import { cn } from '@/lib/utils';

/** Thin rule used between stacked admin sections. */
export function Separator({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div role="separator" className={cn('h-px w-full bg-border', className)} {...props} />;
}
