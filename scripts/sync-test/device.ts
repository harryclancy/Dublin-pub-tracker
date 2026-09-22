/**
 * One simulated phone. Two of these run as separate processes against a single
 * mock backend, each with its own in-memory IndexedDB, so convergence is tested
 * for real rather than mocked.
 *
 *   npx tsx scripts/sync-test/device.ts harry
 *   npx tsx scripts/sync-test/device.ts ava
 */
import 'fake-indexeddb/auto';

// Browser globals the sync engine listens on. Must exist before it's imported.
Object.defineProperty(globalThis, 'navigator', { value: { onLine: true }, configurable: true });
Object.defineProperty(globalThis, 'window', {
  value: { addEventListener() {}, removeEventListener() {} },
  configurable: true,
});
Object.defineProperty(globalThis, 'document', {
  value: { addEventListener() {}, removeEventListener() {}, visibilityState: 'visible' },
  configurable: true,
});

const BASE = `http://localhost:${process.env.MOCK_PORT ?? 5199}`;
const role = process.argv[2] as 'harry' | 'ava';

const { db } = await import('../../src/db/database');
const { SyncEngine } = await import('../../src/sync/engine');
const { installOutboxHooks } = await import('../../src/sync/outbox');
const actions = await import('../../src/db/actions');
const { HttpRemote } = await import('./httpRemote');

installOutboxHooks();
const engine = new SyncEngine(new HttpRemote(BASE));

const log = (...args: unknown[]) => console.log(`[${role}]`, ...args);
const fail = (msg: string) => {
  console.error(`[${role}] ASSERTION FAILED: ${msg}`);
  process.exitCode = 1;
};
const check = (cond: boolean, msg: string) => (cond ? log(`✓ ${msg}`) : fail(msg));

async function signal(name: string) {
  await fetch(`${BASE}/signal`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name }),
  });
}

async function waitFor(name: string, timeoutMs = 20000) {
  const start = Date.now();
  for (;;) {
    const res = await fetch(`${BASE}/signal?name=${name}`);
    if ((await res.json()).set) return;
    if (Date.now() - start > timeoutMs) throw new Error(`timed out waiting for ${name}`);
    await new Promise((r) => setTimeout(r, 100));
  }
}

const PHOTO_BYTES = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3, 4, 5]);

async function seedHarrysExistingData() {
  // Mirrors what's already on the real phone: four reviews (legacy rating +
  // comment, plus one with the newer category ratings), a visit, a drink and
  // its photo, and two visited pubs.
  const now = new Date().toISOString();
  await db.statuses.bulkPut([
    { pubId: 'pub-a', visited: true, firstVisitDate: '2026-05-01', favouriteHarry: true, favouriteAva: false, wantToVisit: false, updatedAt: now },
    { pubId: 'pub-b', visited: true, firstVisitDate: '2026-06-15', favouriteHarry: false, favouriteAva: false, wantToVisit: false, updatedAt: now },
  ]);
  await db.reviews.bulkPut([
    { pubId: 'pub-a', person: 'harry', rating: 4.5, comment: 'Great pint, great crowd.', categories: { comfort: 4 }, categoryNotes: { comfort: 'Comfy seats' }, updatedAt: now },
    { pubId: 'pub-a', person: 'ava', rating: 4, comment: 'Cosy spot, would return.', updatedAt: now },
    { pubId: 'pub-b', person: 'harry', rating: 3.5, comment: 'Decent boozer, bit loud.', updatedAt: now },
    { pubId: 'pub-b', person: 'ava', rating: 3, comment: null, updatedAt: now },
  ]);
  await db.visits.put({ id: 'visit-1', pubId: 'pub-a', date: '2026-05-01', time: '19:30', who: 'both', notes: 'Match night', createdAt: now });
  await db.drinks.put({ id: 'drink-1', visitId: 'visit-1', name: 'Guinness', rating: 4.5, comment: 'Perfect pour', createdAt: now });
  await db.photos.put({
    id: 'photo-1',
    drinkId: 'drink-1',
    blob: new Blob([PHOTO_BYTES]),
    thumbBlob: new Blob([PHOTO_BYTES]),
    createdAt: now,
  });
  await db.guestReviews.put({ pubId: 'pub-a', guestName: 'Sarah', categories: { drinks: 5 }, categoryNotes: {}, updatedAt: now });
}

async function main() {
  if (role === 'harry') {
    await seedHarrysExistingData();
    log('seeded existing on-device data');

    await engine.start(); // initial upload of everything already here
    log('initial sync complete');
    await signal('harry-uploaded');

    // ---- Ava now pulls, then makes her own edits ----
    await waitFor('ava-edited');
    await engine.syncNow();

    const avaReview = await db.reviews.get(['pub-a', 'ava']);
    check(avaReview?.categories?.atmosphere === 5, "Harry sees Ava's new category rating");
    check(avaReview?.comment === 'Cosy spot, would return.', "Ava's original comment survived her edit");
    const pubC = await db.statuses.get('pub-c');
    check(pubC?.visited === true, 'Harry sees the pub Ava marked visited');

    // Harry's own data is still intact after a full round trip.
    const harryReview = await db.reviews.get(['pub-a', 'harry']);
    check(harryReview?.rating === 4.5, "Harry's legacy rating intact");
    check(harryReview?.comment === 'Great pint, great crowd.', "Harry's comment intact");
    check(harryReview?.categories?.comfort === 4, "Harry's category rating intact");
    check((await db.photos.count()) === 1, 'Harry still has his photo');

    // ---- Harry adds a photo; Ava should get the bytes ----
    await actions.addVisit({ pubId: 'pub-c', date: '2026-09-20', time: null, who: 'harry', notes: 'Quick one' });
    const visit = (await db.visits.where('pubId').equals('pub-c').toArray())[0];
    await db.drinks.put({ id: 'drink-2', visitId: visit.id, name: 'Rockshore', rating: 3, comment: null, createdAt: new Date().toISOString() });
    await db.photos.put({
      id: 'photo-2',
      drinkId: 'drink-2',
      blob: new Blob([new Uint8Array([9, 9, 9, 9])]),
      thumbBlob: new Blob([new Uint8Array([9, 9, 9, 9])]),
      createdAt: new Date().toISOString(),
    });
    await new Promise((r) => setTimeout(r, 50)); // let the outbox hooks settle
    await engine.syncNow();
    log('pushed new photo + visit');
    await signal('harry-added-photo');

    await waitFor('ava-done');
    await engine.syncNow();
    check((await db.reviews.get(['pub-b', 'ava']))?.categories?.service === 2, "Harry sees Ava's second edit");
  }

  if (role === 'ava') {
    await waitFor('harry-uploaded');
    await engine.start(); // fresh phone: pulls everything
    log('initial sync complete');

    // ---- Everything Harry already had must be here ----
    check((await db.reviews.count()) === 4, 'all four existing reviews arrived');
    const harryReview = await db.reviews.get(['pub-a', 'harry']);
    check(harryReview?.rating === 4.5, "Harry's legacy star rating arrived");
    check(harryReview?.comment === 'Great pint, great crowd.', "Harry's written review arrived");
    check(harryReview?.categories?.comfort === 4, 'category ratings arrived');
    check(harryReview?.categoryNotes?.comfort === 'Comfy seats', 'category notes arrived');
    check((await db.statuses.get('pub-a'))?.visited === true, 'visited status arrived');
    check((await db.statuses.get('pub-a'))?.favouriteHarry === true, 'favourite flag arrived');
    check((await db.visits.count()) === 1, 'visit arrived');
    check((await db.drinks.get('drink-1'))?.name === 'Guinness', 'drink arrived');
    check((await db.guestReviews.get('pub-a'))?.guestName === 'Sarah', 'guest review arrived');

    const photo = await db.photos.get('photo-1');
    const bytes = photo ? new Uint8Array(await photo.blob.arrayBuffer()) : new Uint8Array();
    check(bytes.length === PHOTO_BYTES.length && bytes[0] === 137 && bytes[12] === 5, 'photo bytes arrived intact');

    // ---- Ava edits her own review and marks a new pub visited ----
    await actions.setReviewCategoryRating('pub-a', 'ava', 'atmosphere', 5);
    await actions.setVisited('pub-c', true, '2026-09-20');
    await new Promise((r) => setTimeout(r, 50));
    await engine.syncNow();
    log('pushed her edits');
    await signal('ava-edited');

    // ---- Harry adds a photo; Ava should receive the bytes ----
    await waitFor('harry-added-photo');
    await engine.syncNow();
    const photo2 = await db.photos.get('photo-2');
    const bytes2 = photo2 ? new Uint8Array(await photo2.blob.arrayBuffer()) : new Uint8Array();
    check(bytes2.length === 4 && bytes2[0] === 9, "Ava received Harry's new photo bytes");
    check((await db.drinks.get('drink-2'))?.name === 'Rockshore', "Ava received Harry's new drink");

    await actions.setReviewCategoryRating('pub-b', 'ava', 'service', 2);
    await new Promise((r) => setTimeout(r, 50));
    await engine.syncNow();
    await signal('ava-done');
  }

  engine.stop();
  log(process.exitCode ? 'FAILED' : 'all checks passed');
}

await main();
