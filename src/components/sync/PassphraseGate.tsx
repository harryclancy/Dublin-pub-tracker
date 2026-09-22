import { useState } from 'react';
import { Beer, Lock } from 'lucide-react';
import { useSync } from '../../sync/SyncProvider';

/** Shown once per device. After this the session is remembered indefinitely,
 * so neither phone is ever asked again. */
export function PassphraseGate() {
  const { unlock } = useSync();
  const [passphrase, setPassphrase] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!passphrase.trim() || busy) return;
    setBusy(true);
    setError(null);
    const result = await unlock(passphrase.trim());
    setBusy(false);
    if (!result.ok) setError(result.error);
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-paper px-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-800 text-white">
            <Beer size={26} strokeWidth={2} />
          </div>
          <h1 className="font-display text-2xl font-bold text-ink">Dublin Pub Tracker</h1>
          <p className="mt-1.5 text-sm text-ink-soft">Harry &amp; Ava's shared pub diary.</p>
        </div>

        <form onSubmit={handleSubmit} className="rounded-card bg-white p-5 shadow-card">
          <label htmlFor="passphrase" className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-soft">
            <Lock size={12} /> Passphrase
          </label>
          <input
            id="passphrase"
            type="password"
            autoFocus
            autoComplete="current-password"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            placeholder="Enter your shared passphrase"
            className="h-12 w-full rounded-xl border border-line bg-paper-dim/50 px-3.5 text-base text-ink placeholder:text-ink-soft/60 focus:border-brand-600 focus:outline-none"
          />
          {error && <p className="mt-2 text-xs font-medium text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={busy || !passphrase.trim()}
            className="mt-4 w-full rounded-xl bg-brand-800 py-3.5 text-sm font-bold text-white transition active:scale-95 disabled:opacity-50"
          >
            {busy ? 'Unlocking…' : 'Unlock'}
          </button>
          <p className="mt-3 text-center text-[11px] leading-relaxed text-ink-soft">
            You'll only be asked once on this phone.
          </p>
        </form>
      </div>
    </div>
  );
}
