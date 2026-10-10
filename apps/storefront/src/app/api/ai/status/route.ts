// Per-store AI readiness status for the AI Studio UI. Returns whether the seller's
// store currently has image generation and WhatsApp sending wired up, so the UI can
// show a clear status line instead of failing silently.
import { NextRequest } from 'next/server';
import { getSellerClient, getOwnStore } from '@/lib/auth';
import { apiOk } from '@/lib/api';

export async function POST(req: NextRequest) {
  const sb = await getSellerClient();
  if (!sb) return apiOk({ ok: false, reason: 'Sign in first.' });

  try {
      type StoreRow = { id: string; name: string; whatsapp_number: string | null };
    const store = await getOwnStore<StoreRow>(sb, 'id, name, whatsapp_number');
    if (!store) return apiOk({ ok: false, reason: 'No store yet.' });

    const phoneIdByStore = (process.env.WHATSAPP_PHONE_ID_BY_STORE as Record<string, string | undefined> | undefined) || {};
    const whatsappTokenPresent = !!(process.env.WHATSAPP_TOKEN?.trim());
    const whatsappPhoneIdPresent =
      !!(process.env.WHATSAPP_PHONE_ID?.trim()) || !!(phoneIdByStore[store.id]?.trim());

    const whatsappNumber = await sb
      .from('whatsapp_settings')
      .select('business_number')
      .eq('store_id', store.id)
      .maybeSingle()
      .then((row) => ((row.data as { business_number: string | null } | null)?.business_number ?? null));

    const storeWhatsappNumber = store.whatsapp_number ?? whatsappNumber;

    return apiOk({
      ok: true,
      storeId: store.id,
      imageGen: {
        enabled: !!(process.env.GEMINI_API_KEY?.trim()),
        provider: !!(process.env.GEMINI_API_KEY?.trim()) ? 'gemini' : 'dummy',
      },
      whatsapp: {
        configured: whatsappTokenPresent && whatsappPhoneIdPresent && !!storeWhatsappNumber,
        hasNumber: !!storeWhatsappNumber,
        tokenSet: whatsappTokenPresent,
        phoneIdSet: whatsappPhoneIdPresent,
      },
    });
  } catch {
    return apiOk({ ok: false, reason: 'Could not read status.' });
  }
}
