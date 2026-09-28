import { revalidatePath } from 'next/cache';

// Store pages are ISR-cached (revalidate: 60) for speed; this evicts them instantly
// when the seller changes their store. Call after a successful DB write.
export function revalidateStore(slug: string) {
  revalidatePath(`/s/${slug}`);
  revalidatePath(`/s/${slug}/catalogue`);
  revalidatePath('/');
  revalidatePath('/discover');
  revalidatePath('/rankings');
}
