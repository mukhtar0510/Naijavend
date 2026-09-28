// Client-side cleanup of Supabase browser-storage leftovers.
//
// The pre-PKCE era ran Google OAuth in implicit flow, which leaves a
// half-session under `sb-<ref>-auth-token` in localStorage (and its now-
// obsolete code verifiers under `sb-<ref>-auth-token-code-verifier`). A stale
// session/verifier from an older attempt can confuse a fresh flow, so we
// purge before starting OAuth and again after the callback finishes. Our real
// sessions live in httpOnly cookies — localStorage is never needed.
export function purgeSupabaseBrowserState(): void {
  if (typeof window === 'undefined') return;
  try {
    for (const key of Object.keys(window.localStorage)) {
      if (key.startsWith('sb-') && key.includes('-auth-token')) {
        window.localStorage.removeItem(key);
      }
    }
    // supabase-js v1 legacy key, just in case.
    window.localStorage.removeItem('supabase.auth.token');
  } catch {
    // Storage can be unavailable (private mode) — cleanup is best-effort.
  }
}
