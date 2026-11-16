// Testele pentru problemele găsite la recenzia finală a Planului 1b.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

let server;
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'porumbar-review1b-'));
before(async () => {
  // Poze rămase de la o versiune veche (înainte ca pozele să fie scoase).
  fs.mkdirSync(path.join(dataDir, 'photos'));
  fs.writeFileSync(path.join(dataDir, 'photos', '1'), 'poza veche');
  process.env.DATA_DIR = dataDir;
  const { startTestApp } = await import('./helpers/db.js');
  ({ server } = await startTestApp());
});
after(() => {
  server?.close();
  fs.rmSync(dataDir, { recursive: true, force: true });
});

test('la pornire, pozele vechi de pe disc se șterg (fără spațiu ocupat)', () => {
  assert.equal(fs.existsSync(path.join(dataDir, 'photos')), false);
});

test('rețeaua „tot porumbarul” se oprește implicit la 200 (telefonul nu se blochează)', async () => {
  delete process.env.NETWORK_LIMIT;
  const { networkLimit } = await import('../src/routes/views.js');
  assert.equal(networkLimit(), 200);
});
