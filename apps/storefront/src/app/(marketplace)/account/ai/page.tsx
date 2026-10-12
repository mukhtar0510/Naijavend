import type { Metadata } from 'next';
import { Suspense } from 'react';
import AiAssistantPage from './AiAssistantPage';

export const metadata: Metadata = { title: 'Ask Naijavend — your shopping assistant' };

// AiAssistantPage reads the ?q= deep link via useSearchParams(), which Next 14
// requires to be inside a Suspense boundary during static prerender.
export default function AiPage() {
  return (
    <Suspense fallback={null}>
      <AiAssistantPage />
    </Suspense>
  );
}
