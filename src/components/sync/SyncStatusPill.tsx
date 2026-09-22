import { AnimatePresence, motion } from 'framer-motion';
import { CloudOff, RefreshCw, TriangleAlert } from 'lucide-react';
import { useSync } from '../../sync/SyncProvider';

/** Deliberately quiet: nothing is shown while syncing is healthy and idle —
 * it only speaks up when there's something worth knowing. */
export function SyncStatusPill() {
  const { mode, status } = useSync();
  if (mode !== 'ready') return null;

  const showing = status.state === 'offline' || status.state === 'error' || status.pendingCount > 0;

  const label =
    status.state === 'offline'
      ? status.pendingCount > 0
        ? `Offline · ${status.pendingCount} to sync`
        : 'Offline'
      : status.state === 'error'
        ? 'Sync issue — will retry'
        : `Saving ${status.pendingCount}…`;

  const Icon = status.state === 'offline' ? CloudOff : status.state === 'error' ? TriangleAlert : RefreshCw;

  return (
    <AnimatePresence>
      {showing && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          className="pointer-events-none fixed inset-x-0 bottom-20 z-30 flex justify-center lg:bottom-6"
        >
          <span className="flex items-center gap-1.5 rounded-full bg-ink/90 px-3 py-1.5 text-[11px] font-semibold text-white shadow-pop backdrop-blur">
            <Icon size={12} className={status.state === 'syncing' ? 'animate-spin' : ''} />
            {label}
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
