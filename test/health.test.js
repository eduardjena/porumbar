import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { apiCaller } from './helpers/api.js';
import { startTestApp } from './helpers/db.js';

let server;
let base;
before(async () => ({ server, base } = await startTestApp()));
after(() => server?.close());
const call = apiCaller(() => ({ base }));

test('serverul răspunde și migrările au rulat', async () => {
  const r = await call('/api/health', { auth: 'none' });
  assert.equal(r.status, 200);
  assert.deepEqual(r.data, { ok: true });
  const { one } = await import('../src/db.js');
  assert.ok((await one('SELECT max(version) AS v FROM schema_version')).v >= 1);
});

test('POST fără JSON e refuzat', async () => {
  const res = await fetch(`${base}/api/health`, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: 'x' });
  assert.equal(res.status, 415);
});
