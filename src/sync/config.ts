/**
 * Supabase connection details for the shared Harry + Ava database.
 *
 * These two values are designed to be public — the anon key only grants what
 * the database's row-level security policies allow, and those require an
 * authenticated session (i.e. the shared passphrase). Committing them is the
 * normal, intended way to ship a Supabase front end.
 */
export const SUPABASE_URL = '';
export const SUPABASE_ANON_KEY = '';

/** The single shared account Harry and Ava both sign into with one passphrase. */
export const SHARED_ACCOUNT_EMAIL = 'harryandava@pubtracker.app';

export function isSyncConfigured(): boolean {
  return SUPABASE_URL.length > 0 && SUPABASE_ANON_KEY.length > 0;
}
