// Seller bank details for "pay by bank transfer" at checkout. Owner-only (RLS);
// buyers see them only on their own order page, through the server.
import { NextRequest } from 'next/server';
import { getSellerClient, getOwnStore } from '@/lib/auth';
import { apiError, apiOk, internalError } from '@/lib/api';
import { sanitizeText } from '@idevtenancy/shared';

export async function POST(req: NextRequest) {
  const sb = await getSellerClient();
  if (!sb) return apiError(401, 'unauthenticated', 'Sign in first.');
  let b: Record<string, unknown>;
  try {
    b = (await req.json()) as Record<string, unknown>;
  } catch {
    return apiError(400, 'invalid_json', 'Request body must be JSON.');
  }
  try {
    const store = await getOwnStore<{ id: string }>(sb, 'id');
    if (!store) return apiError(403, 'no_store', 'Only the store owner can set bank details.');

    if (b.remove === true) {
      await sb.from('store_bank_accounts').delete().eq('store_id', store.id);
      return apiOk({ removed: true });
    }
    const bankName = sanitizeText(b.bankName, 60);
    const accountName = sanitizeText(b.accountName, 80);
    const accountNumber = sanitizeText(b.accountNumber, 20).replace(/\D/g, '');
    if (bankName.length < 2) return apiError(422, 'invalid_bank', 'Enter the bank name.');
    if (accountName.length < 2) return apiError(422, 'invalid_name', 'Enter the account name.');
    if (!/^\d{10}$/.test(accountNumber)) return apiError(422, 'invalid_number', 'The account number must be 10 digits.');
    const { error } = await sb
      .from('store_bank_accounts')
      .upsert({ store_id: store.id, bank_name: bankName, account_name: accountName, account_number: accountNumber, updated_at: new Date().toISOString() });
    if (error) return apiError(500, 'save_failed', 'Could not save. Is the delivery/bank migration applied?');
    return apiOk({ saved: true });
  } catch (err) {
    return internalError('bank', err);
  }
}
