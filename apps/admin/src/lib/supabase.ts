import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Standalone admin app — self-contained Supabase clients (mirrors the
// storefront's lib/supabase.ts so this app has zero workspace dependencies).

// Public/anon client — used only for signInWithPassword on the server.
let anonClient: SupabaseClient | null = null;
export function supabaseAnon(): SupabaseClient {
  if (anonClient) return anonClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY.');
  }
  anonClient = createClient(url, key, { auth: { persistSession: false } });
  return anonClient;
}

// Service-role client — bypasses RLS. SERVER ONLY.
let svcClient: SupabaseClient | null = null;
export function supabaseServiceOptional(): SupabaseClient | null {
  if (svcClient) return svcClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  svcClient = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return svcClient;
}

export function supabaseService(): SupabaseClient {
  const client = supabaseServiceOptional();
  if (!client) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY.');
  }
  return client;
}
