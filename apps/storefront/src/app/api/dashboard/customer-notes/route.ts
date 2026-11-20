// T12: persist a seller's private note about a buyer. RLS also enforces store
// ownership; the explicit lookup keeps the error readable when a store id is
// forged or the migration has not been applied yet.
import { NextRequest } from 'next/server';
import { getSellerClient, getOwnStore } from '@/lib/auth';
import { apiError, apiOk, internalError } from '@/lib/api';
import { sanitizeText } from '@idevtenancy/shared';

export async function POST(req: NextRequest) {
  const sb = await getSellerClient();
  if (!sb) return apiError(401, 'unauthenticated', 'Sign in first.');

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError(400, 'invalid_json', 'Request body must be JSON.');
  }

  const b = body as Record<string, unknown>;
  const phone = sanitizeText(b.phone, 32);
  const note = sanitizeText(b.note, 2000);

  if (phone.length < 5) return apiError(422, 'invalid_phone', 'Missing customer phone.');

  try {
    const store = await getOwnStore<{ id: string }>(sb, 'id');
    if (!store) return apiError(404, 'no_store', 'You do not have a store yet.');

    if (!note.trim()) {
      const { error } = await sb
        .from('store_customer_notes')
        .delete()
        .eq('store_id', store.id)
        .eq('phone', phone);
      if (error) throw error;
      return apiOk({ saved: false });
    }

    const { error } = await sb.from('store_customer_notes').upsert(
      {
        store_id: store.id,
        phone,
        note: note.trim(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'store_id,phone' }
    );

    if (error) {
      // Table missing → migration not applied. Tell the client so it can keep
      // the note locally instead of silently losing it.
      const notReady = /does not exist|schema cache/i.test(error.message);
      return apiError(
        notReady ? 503 : 500,
        notReady ? 'migration_pending' : 'note_save_failed',
        notReady ? 'Notes are not enabled on this database yet.' : 'Could not save that note.'
      );
    }

    return apiOk({ saved: true });
  } catch (err) {
    return internalError('customer-notes', err);
  }
}
