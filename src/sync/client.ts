import type { SupabaseClient } from '@supabase/supabase-js';
import { SHARED_ACCOUNT_EMAIL, SUPABASE_ANON_KEY, SUPABASE_URL, isSyncConfigured } from './config';

let clientPromise: Promise<SupabaseClient> | null = null;

/**
 * The Supabase SDK is a few hundred KB, so it's fetched on demand rather than
 * in the main bundle — the pub list and map still paint immediately on a phone,
 * and sync connects a moment later.
 */
export async function getClient(): Promise<SupabaseClient | null> {
  if (!isSyncConfigured()) return null;
  if (!clientPromise) {
    clientPromise = import('@supabase/supabase-js').then(({ createClient }) =>
      createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          // Keeps both phones signed in across restarts and refreshes, so the
          // passphrase is only ever typed once per device.
          persistSession: true,
          autoRefreshToken: true,
          storageKey: 'dpt.auth',
        },
      })
    );
  }
  return clientPromise;
}

export async function hasSession(): Promise<boolean> {
  const supabase = await getClient();
  if (!supabase) return false;
  const { data } = await supabase.auth.getSession();
  return !!data.session;
}

export async function signInWithPassphrase(passphrase: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await getClient();
  if (!supabase) return { ok: false, error: 'Sync is not configured yet.' };

  const { error } = await supabase.auth.signInWithPassword({
    email: SHARED_ACCOUNT_EMAIL,
    password: passphrase,
  });

  if (error) {
    return { ok: false, error: friendlyAuthError(error.message) };
  }
  return { ok: true };
}

function friendlyAuthError(message: string): string {
  if (/invalid login credentials/i.test(message)) return "That passphrase doesn't match.";
  if (/failed to fetch|network|timeout/i.test(message)) {
    return "Couldn't reach the server — check your connection and try again.";
  }
  return message;
}

export async function signOut(): Promise<void> {
  const supabase = await getClient();
  await supabase?.auth.signOut();
}
