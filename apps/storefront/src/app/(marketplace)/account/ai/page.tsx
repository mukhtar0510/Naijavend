import type { Metadata } from 'next';
import AiAssistantPage from './AiAssistantPage';

export const metadata: Metadata = { title: 'Ask Naijavend — your shopping assistant' };

export default function AiPage() {
  return <AiAssistantPage />;
}
