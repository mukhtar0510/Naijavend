import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Session } from '@supabase/supabase-js';

// Lightweight session store — one listener, shared across screens via this hook.
let currentSession: Session | null = null;
let initialized = false;
const listeners = new Set<(s: Session | null) => void>();

function setSession(session: Session | null) {
  currentSession = session;
  listeners.forEach((fn) => fn(session));
}

export function useSession() {
  const [session, setLocal] = useState<Session | null>(currentSession);
  const [loading, setLoading] = useState(!initialized);

  useEffect(() => {
    listeners.add(setLocal);
    if (!initialized) {
      initialized = true;
      supabase.auth
        .getSession()
        .then(({ data }) => setSession(data.session))
        .finally(() => listeners.forEach(() => setLocal(currentSession)));
      supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    }
    setLoading(false);
    return () => {
      listeners.delete(setLocal);
    };
  }, []);

  return { session, loading };
}

export async function signIn(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signUp(email: string, password: string) {
  const { error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
}

export async function signOut() {
  await supabase.auth.signOut();
  setSession(null);
}
