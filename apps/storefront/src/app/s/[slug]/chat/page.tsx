import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { supabaseAnon } from '@/lib/supabase';
import { ChatBox } from '@/components/ChatBox';
import { isValidPhone } from '@idevtenancy/shared';
import { WhatsAppButton } from '@/components/WhatsAppButton';
import { getCustomerUser } from '@/lib/auth';
import type { Store } from '@idevtenancy/shared';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  try {
    const { data: store } = await supabaseAnon().from('stores').select('name').eq('slug', params.slug).maybeSingle();
    return { title: store?.name ? `Chat with ${store.name}` : 'Chat' };
  } catch {
    return { title: 'Chat' };
  }
}

export default async function StoreChatPage({ params }: { params: { slug: string } }) {
  const sb = supabaseAnon();
  const { data: store } = await sb.from('stores').select('id, name, slug, whatsapp_number').eq('slug', params.slug).maybeSingle();
  if (!store) notFound();
  const s = store as Store;

  const user = await getCustomerUser();
  const { data: wa } = await sb.from('whatsapp_settings').select('business_number').eq('store_id', s.id).maybeSingle();
  const waNumber = (wa as { business_number: string } | null)?.business_number || s.whatsapp_number;

  return (
    <main>
      <div className="container" style={{ padding: '28px 20px', maxWidth: 720 }}>
        <nav aria-label="Breadcrumb" style={{ marginBottom: 14 }}>
          <Link href={`/s/${s.slug}`} className="muted">← Back to {s.name}</Link>
        </nav>
        <h1>Chat with {s.name}</h1>
        <p className="muted" style={{ marginBottom: 20 }}>
          Ask about availability, prices, delivery or booking — messages go straight to the seller.
        </p>

        {user ? (
          <ChatBox storeId={s.id} role="customer" />
        ) : (
          <div className="card card-elevated" style={{ textAlign: 'center', padding: 28 }}>
            <p style={{ fontSize: 16, marginBottom: 6 }}>
              <strong>Sign in to chat</strong>
            </p>
            <p className="muted" style={{ marginBottom: 18 }}>
              Chat history is tied to your account so nothing gets lost.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link className="btn btn-primary" href="/account/signin">Sign in</Link>
              {isValidPhone(waNumber ?? '') && (
                <WhatsAppButton
                  businessNumber={waNumber!}
                  storeName={s.name}
                  label="Or use WhatsApp"
                  className="btn btn-whatsapp"
                />
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
