/**
 * Guards the property that makes continuous background syncing safe: once
 * everything is in step, syncing again must be a no-op. If a pull could
 * re-queue the rows it just applied, the two phones would push to each other
 * forever — draining battery, data, and the free tier's quota.
 *
 *   npx tsx scripts/sync-test/idempotency.ts
 */
import 'fake-indexeddb/auto';

Object.defineProperty(globalThis, 'navigator', { value: { onLine: true }, configurable: true });
Object.defineProperty(globalThis, 'window', { value: { addEventListener() {}, removeEventListener() {} }, configurable: true });
Object.defineProperty(globalThis, 'document', {
  value: { addEventListener() {}, removeEventListener() {}, visibilityState: 'visible' },
  configurable: true,
});

const BASE = `http://localhost:${process.env.MOCK_PORT ?? 5199}`;

const { db } = await import('../../src/db/database');
const { SyncEngine } = await import('../../src/sync/engine');
const { installOutboxHooks } = await import('../../src/sync/outbox');
const { HttpRemote } = await import('./httpRemote');

installOutboxHooks();
const engine = new SyncEngine(new HttpRemote(BASE));

let failed = false;
const check = (cond: boolean, msg: string) => {
  console.log(`${cond ? '✓' : 'ASSERTION FAILED:'} ${msg}`);
  if (!cond) failed = true;
};

async function backendState() {
  const res = await fetch(`${BASE}/debug`);
  const { records } = (await res.json()) as { records: { id: string; collection: string; updated_at: string }[] };
  return records.map((r) => `${r.collection}:${r.id}@${r.updated_at}`).sort().join('|');
}

const now = new Date().toISOString();
await db.statuses.put({
  pubId: 'idem-pub', visited: true, firstVisitDate: '2026-09-01',
  favouriteHarry: false, favouriteAva: false, wantToVisit: false, updatedAt: now,
});
await db.reviews.put({ pubId: 'idem-pub', person: 'harry', rating: 5, comment: 'Grand', updatedAt: now });

await engine.start();
await new Promise((r) => setTimeout(r, 100));
await engine.syncNow();

const afterFirst = await backendState();
check((await db.outbox.count()) === 0, 'outbox drains to empty after syncing');

for (let i = 0; i < 4; i++) {
  await engine.syncNow();
  await new Promise((r) => setTimeout(r, 60));
}

const afterRepeats = await backendState();
check(afterRepeats === afterFirst, 'four further syncs write nothing new (no push/pull ping-pong)');
check((await db.outbox.count()) === 0, 'outbox still empty after repeated syncs');

engine.stop();
console.log(failed ? 'FAILED' : 'idempotency checks passed');
process.exitCode = failed ? 1 : 0;
