/**
 * Runs the sync test suite: boots the mock backend, then drives two simulated
 * phones (separate processes, separate IndexedDB) plus an idempotency check.
 *
 *   npm run test:sync
 */
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const PORT = 5199;
const BASE = `http://localhost:${PORT}`;

function run(cmd, args, opts = {}) {
  return spawn(cmd, args, { stdio: 'inherit', env: { ...process.env, MOCK_PORT: String(PORT) }, ...opts });
}

function waitForExit(child) {
  return new Promise((resolve) => child.on('exit', (code) => resolve(code ?? 1)));
}

async function waitForBackend() {
  for (let i = 0; i < 50; i++) {
    try {
      const res = await fetch(`${BASE}/debug`);
      if (res.ok) return;
    } catch {
      /* not up yet */
    }
    await sleep(100);
  }
  throw new Error('mock backend did not start');
}

let failures = 0;

async function withBackend(fn) {
  const backend = spawn('node', ['scripts/sync-test/mock-backend.mjs', String(PORT)], { stdio: 'ignore' });
  try {
    await waitForBackend();
    await fn();
  } finally {
    backend.kill();
    await sleep(200);
  }
}

console.log('\n── two-device sync ──');
await withBackend(async () => {
  const ava = run('npx', ['tsx', 'scripts/sync-test/device.ts', 'ava']);
  const harry = run('npx', ['tsx', 'scripts/sync-test/device.ts', 'harry']);
  const [harryCode, avaCode] = await Promise.all([waitForExit(harry), waitForExit(ava)]);
  if (harryCode !== 0 || avaCode !== 0) failures++;
});

console.log('\n── sync idempotency ──');
await withBackend(async () => {
  const code = await waitForExit(run('npx', ['tsx', 'scripts/sync-test/idempotency.ts']));
  if (code !== 0) failures++;
});

console.log(failures === 0 ? '\nAll sync tests passed.\n' : `\n${failures} sync test group(s) failed.\n`);
process.exit(failures === 0 ? 0 : 1);
