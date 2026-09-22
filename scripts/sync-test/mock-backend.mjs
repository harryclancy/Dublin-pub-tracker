/**
 * A stand-in for Supabase used only by scripts/sync-test/*. It implements the
 * same contract the SupabaseRemote adapter relies on (a records table ordered
 * by server-assigned updated_at, plus photo bytes), so the sync engine can be
 * exercised for real — two processes, one shared backend, over HTTP.
 */
import { createServer } from 'node:http';

const records = new Map(); // `${collection}:${id}` -> {collection,id,data,deleted,updated_at}
const photos = new Map(); // photoId -> {full: Buffer, thumb: Buffer}
const signals = new Set(); // barrier names, for coordinating the two devices

let clock = 0;
function nextTimestamp() {
  // Strictly increasing so cursor ordering is deterministic in tests.
  clock += 1;
  return new Date(Date.UTC(2026, 0, 1, 0, 0, 0, 0) + clock).toISOString();
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const send = (code, body) => {
    res.writeHead(code, { 'content-type': 'application/json' });
    res.end(JSON.stringify(body));
  };

  try {
    if (url.pathname === '/pull' && req.method === 'POST') {
      const { since } = JSON.parse((await readBody(req)).toString() || '{}');
      const rows = [...records.values()]
        .filter((r) => !since || r.updated_at >= since)
        .sort((a, b) => a.updated_at.localeCompare(b.updated_at));
      return send(200, { rows });
    }

    if (url.pathname === '/push' && req.method === 'POST') {
      const { changes } = JSON.parse((await readBody(req)).toString());
      for (const c of changes) {
        records.set(`${c.collection}:${c.id}`, {
          collection: c.collection,
          id: c.id,
          data: c.deleted ? null : c.data,
          deleted: !!c.deleted,
          updated_at: nextTimestamp(),
        });
      }
      return send(200, { ok: true });
    }

    if (url.pathname.startsWith('/photo/')) {
      const [, , photoId, variant] = url.pathname.split('/');
      if (req.method === 'PUT') {
        const body = await readBody(req);
        const entry = photos.get(photoId) ?? {};
        entry[variant] = body;
        photos.set(photoId, entry);
        return send(200, { ok: true });
      }
      if (req.method === 'GET') {
        const entry = photos.get(photoId);
        if (!entry?.[variant]) return send(404, { error: 'not found' });
        res.writeHead(200, { 'content-type': 'application/octet-stream' });
        return res.end(entry[variant]);
      }
      if (req.method === 'DELETE') {
        photos.delete(photoId);
        return send(200, { ok: true });
      }
    }

    // Tiny barrier primitives so two device processes can take turns.
    if (url.pathname === '/signal' && req.method === 'POST') {
      const { name } = JSON.parse((await readBody(req)).toString());
      signals.add(name);
      return send(200, { ok: true });
    }
    if (url.pathname === '/signal' && req.method === 'GET') {
      return send(200, { set: signals.has(url.searchParams.get('name')) });
    }

    if (url.pathname === '/debug' && req.method === 'GET') {
      return send(200, {
        recordCount: records.size,
        photoCount: photos.size,
        records: [...records.values()],
      });
    }

    send(404, { error: 'unknown route' });
  } catch (err) {
    send(500, { error: String(err) });
  }
});

const port = Number(process.argv[2] ?? 5199);
server.listen(port, () => console.log(`mock backend on ${port}`));
