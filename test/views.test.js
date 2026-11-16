import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { apiCaller } from './helpers/api.js';
import { startTestApp } from './helpers/db.js';
import { newAccount } from './helpers/accounts.js';
import { loadPedigree } from './helpers/load-pedigree.js';
import { PEDIGREE_FOTO } from './fixtures/pedigree-foto.js';

let server;
let base;
let a;
let b;
let rootId;
const call = apiCaller(() => ({ base }));
before(async () => {
  ({ server, base } = await startTestApp());
  a = await newAccount(call, 'A');
  b = await newAccount(call, 'B');
  rootId = await loadPedigree(call, a, PEDIGREE_FOTO);
  await call(`/api/pigeons/${rootId}`, { method: 'PATCH', cookie: a, body: { evaluation: { scores: { echilibru: 4 } } } });
});
after(() => server?.close());

test('panoul: porumbeii proprii, cu anul și valoarea, cei mai valoroși primii', async () => {
  let r = await call('/api/board', { cookie: a });
  assert.equal(r.status, 200);
  assert.equal(r.data.pigeons.length, 1, 'doar porumbeii proprii');
  const root = r.data.pigeons[0];
  assert.equal(root.year, 2015);
  assert.equal(root.offspringCount, 0);
  assert.equal(root.value.score, 38);

  const rep = (await call('/api/pigeons', { method: 'POST', cookie: a, body: { kind: 'own', ring: 'RO-20-500001', sex: 'M', status: 'reproducator' } })).data.pigeon;
  for (const ring of ['RO-24-500002', 'RO-24-500003']) {
    const kid = (await call('/api/pigeons', { method: 'POST', cookie: a, body: { kind: 'own', ring } })).data.pigeon;
    await call(`/api/pigeons/${kid.id}/parents`, { method: 'PUT', cookie: a, body: { fatherId: rep.id, motherId: null } });
  }
  r = await call('/api/board', { cookie: a });
  assert.equal(r.data.pigeons[0].id, rep.id);
  assert.equal(r.data.pigeons[0].offspringCount, 2);
  assert.equal(r.data.pigeons.at(-1).value.score, null, 'puii fără date la final');
});

test('anul apare și în arbore', async () => {
  const t = await call(`/api/pigeons/${rootId}/tree?generations=1`, { cookie: a });
  assert.equal(t.data.pigeons[rootId].year, 2015);
});

test('rețeaua: fiecare porumbel o singură dată', async () => {
  const r = await call(`/api/network?rootId=${rootId}&up=4&down=0`, { cookie: a });
  assert.equal(r.status, 200);
  assert.equal(r.data.nodes.length, 27);
  assert.equal(r.data.truncated, false);
  const kras = r.data.nodes.find((n) => n.ring === 'NL-04-1954746');
  assert.ok(kras);
  assert.equal(r.data.edges.filter((e) => e.from === kras.id).length, 3);
  assert.ok(r.data.edges.every((e) => ['father', 'mother'].includes(e.role)));
  // Review Focus 5
  const unringed = r.data.nodes.find((n) => n.ring === 'fără inel' || n.ring === '000 M');
  assert.ok(unringed);
  assert.equal(unringed.year, null);
});

test('rețeaua cu cicluri vechi nu se blochează (Review Focus 2)', async () => {
  const { run, one } = await import('../src/db.js');
  const grand = await one(`SELECT id FROM pigeons WHERE ring_raw = '037069/08 RO M'`);
  await run('UPDATE pigeons SET father_id = ? WHERE id = ?', rootId, grand.id);
  const r = await call(`/api/network?rootId=${rootId}&up=10&down=10`, { cookie: a });
  assert.equal(r.status, 200);
  await run('UPDATE pigeons SET father_id = NULL WHERE id = ?', grand.id);
  assert.equal((await call('/api/network', { cookie: a })).status, 200);
});

test('alt cont nu vede nimic (Review Focus 3)', async () => {
  assert.deepEqual((await call('/api/board', { cookie: b })).data.pigeons, []);
  assert.deepEqual((await call('/api/network', { cookie: b })).data.nodes, []);
  assert.equal((await call(`/api/network?rootId=${rootId}`, { cookie: b })).status, 404);
  assert.equal((await call('/api/board', { auth: 'none' })).status, 401);
});

test('porumbar foarte mare: rețeaua se oprește la limită (Review Focus 4)', async () => {
  process.env.NETWORK_LIMIT = '5';
  const r = await call('/api/network', { cookie: a });
  delete process.env.NETWORK_LIMIT;
  assert.equal(r.data.truncated, true);
  assert.equal(r.data.nodes.length, 5);
});

test('parametri greșiți', async () => {
  assert.equal((await call(`/api/network?rootId=${rootId}&up=11`, { cookie: a })).status, 400);
  assert.equal((await call(`/api/network?rootId=${rootId}&down=-1`, { cookie: a })).status, 400);
});
