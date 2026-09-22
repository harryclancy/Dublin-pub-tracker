import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { getClient, hasSession, signInWithPassphrase, signOut } from './client';
import { isSyncConfigured } from './config';
import { SyncEngine, type SyncStatus } from './engine';
import { installOutboxHooks } from './outbox';
import { SupabaseRemote } from './supabaseRemote';

export type SyncMode = 'unconfigured' | 'locked' | 'ready';

interface SyncContextValue {
  mode: SyncMode;
  status: SyncStatus;
  unlock: (passphrase: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  lock: () => Promise<void>;
  syncNow: () => Promise<void>;
}

const SyncContext = createContext<SyncContextValue | null>(null);

// Installed once, immediately: every local write from here on is recorded for
// upload, including writes made before the engine finishes starting.
installOutboxHooks();

export function SyncProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<SyncMode>(isSyncConfigured() ? 'locked' : 'unconfigured');
  const [status, setStatus] = useState<SyncStatus>({
    state: 'idle',
    lastSyncedAt: null,
    pendingCount: 0,
    error: null,
  });
  const engineRef = useRef<SyncEngine | null>(null);

  const startEngine = useCallback(async () => {
    const supabase = await getClient();
    if (!supabase || engineRef.current) return;
    const engine = new SyncEngine(new SupabaseRemote(supabase));
    engineRef.current = engine;
    engine.onStatus(setStatus);
    void engine.start();
  }, []);

  useEffect(() => {
    if (!isSyncConfigured()) return;
    let cancelled = false;
    let unsubscribe: (() => void) | null = null;

    void (async () => {
      const signedIn = await hasSession();
      if (cancelled) return;
      if (signedIn) {
        setMode('ready');
        void startEngine();
      } else {
        setMode('locked');
      }

      const supabase = await getClient();
      if (!supabase || cancelled) return;
      const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session) {
          setMode('ready');
          void startEngine();
        } else {
          setMode('locked');
        }
      });
      unsubscribe = () => sub.subscription.unsubscribe();
    })();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [startEngine]);

  useEffect(() => {
    return () => engineRef.current?.stop();
  }, []);

  const unlock = useCallback(async (passphrase: string) => {
    const result = await signInWithPassphrase(passphrase);
    if (result.ok) {
      setMode('ready');
      void startEngine();
    }
    return result;
  }, [startEngine]);

  const lock = useCallback(async () => {
    engineRef.current?.stop();
    engineRef.current = null;
    await signOut();
    setMode('locked');
  }, []);

  const syncNow = useCallback(async () => {
    await engineRef.current?.syncNow();
  }, []);

  const value = useMemo<SyncContextValue>(
    () => ({ mode, status, unlock, lock, syncNow }),
    [mode, status, unlock, lock, syncNow]
  );

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSync(): SyncContextValue {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error('useSync must be used within SyncProvider');
  return ctx;
}
