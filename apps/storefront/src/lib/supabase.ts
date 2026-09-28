import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Public/anon client — subject to RLS. Safe anywhere.
// Memoised: one client instance per server process instead of one per call.
let anonClient: SupabaseClient | null = null;
export function supabaseAnon(): SupabaseClient {
  if (anonClient) return anonClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY. Copy .env.example to .env.local and fill in your Supabase project values.');
  }
  anonClient = createClient(url, key, { auth: { persistSession: false } });
  return anonClient;
}

// Service-role client — bypasses RLS. SERVER ONLY. Never import from client components.
export function supabaseService(): SupabaseClient {
  const client = supabaseServiceOptional();
  if (!client) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY. Set it in .env.local (server-side only).');
  }
  return client;
}

// Same as supabaseService but returns null instead of throwing — for page reads that
// should degrade to a friendly message rather than a 500 when the key isn't configured.
export function supabaseServiceOptional(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
