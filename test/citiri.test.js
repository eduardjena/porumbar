import { test, before, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { apiCaller } from './helpers/api.js';
import { startTestApp } from './helpers/db.js';
import { adminCookie, newAccount, today } from './helpers/accounts.js';

// Citirile din poze sunt incluse în abonament (docs/superpowers/specs/2026-11-18-citiri-incluse-design.md).
// Aici limita pe an e 3, ca testele să fie scurte (implicit 200).
let server;
let base;
let admin;
let reader;
const call = apiCaller(() => ({ base }));
const me = async (cookie) => (await call('/api/auth/me', { cookie })).data.account;
const photo = { mime: 'image/png', data: Buffer.from('x').toString('base64') };
const read = (cookie) => call('/api/pedigrees/read', { method: 'POST', cookie, body: photo });

before(async () => {
  process.env.PEDIGREE_READS_PER_YEAR = '3';
  process.env.PEDIGREE_READS_PER_DAY = '20';
  ({ server, base } = await startTestApp());
  admin = await adminCookie(call);
  reader = await import('../src/pedigree-reader.js');
  reader.setPedigreeModel(async () => ({
    slots: [{ slot: 1, ring: 'RO-20-1', name: null, color: null, text: null, breeder: null }],
    rootSex: null,
    notes: '',
    usage: { input_tokens: 10_000, output_tokens: 5_000 }, // 0,04 $ + 0,10 $ = 0,14 $
  }));
});
afterEach(() => undefined);
after(() => {
  reader?.setPedigreeModel(null);
  server?.close();
});

test('un cont activat citește fără credit; la limita pe an se oprește cu mesaj clar', async () => {
  const c = await newAccount(call, 'Cititor');
  assert.deepEqual((await me(c)).reads, { used: 0, allowed: 3 });
  for (let i = 0; i < 3; i++) assert.equal((await read(c)).status, 200, `citirea ${i + 1}`);
  assert.deepEqual((await me(c)).reads, { used: 3, allowed: 3 });
  const over = await read(c);
  assert.equal(over.status, 402);
  assert.match(over.data.error, /3 citiri/);
  assert.match(over.data.error, /de mână/);
});

test('vânzătorul dă citiri în plus; la prelungirea abonamentului ele se pun pe zero', async () => {
  const c = await newAccount(call, 'Extra');
  const id = (await me(c)).id;
  for (let i = 0; i < 3; i++) await read(c);
  const plus = await call(`/api/admin/accounts/${id}/reads`, { method: 'POST', cookie: admin, body: { amount: 2, note: 'a cerut' } });
  assert.equal(plus.status, 200, JSON.stringify(plus.data));
  assert.equal(plus.data.account.reads.allowed, 5);
  assert.equal((await read(c)).status, 200);
  assert.deepEqual((await me(c)).reads, { used: 4, allowed: 5 });
  const detail = (await call(`/api/admin/accounts/${id}`, { cookie: admin })).data;
  assert.ok(detail.events.some((e) => e.kind === 'reads' && e.note?.includes('a cerut')));
  await call(`/api/admin/accounts/${id}/subscription`, { method: 'POST', cookie: admin, body: { start: today() } });
  assert.equal((await me(c)).reads.allowed, 3, 'citirile în plus țin doar pentru anul lor');
  for (const amount of [0, 1.5, '2', null, 100000, -100000]) {
    assert.equal((await call(`/api/admin/accounts/${id}/reads`, { method: 'POST', cookie: admin, body: { amount } })).status, 400, JSON.stringify(amount));
  }
});

test('lista din consolă: câte citiri a făcut fiecare din câte are și cât au costat (în dolari)', async () => {
  const c = await newAccount(call, 'Cost');
  const id = (await me(c)).id;
  await read(c);
  await read(c);
  const list = (await call('/api/admin/accounts', { cookie: admin })).data.accounts;
  const row = list.find((r) => r.id === id);
  assert.deepEqual(row.reads, { used: 2, allowed: 3, costUsd: 0.28 });
  assert.equal(row.aiCredit, undefined, 'creditul nu mai există');
});

test('adminul (vânzătorul) citește fără limită pe an', async () => {
  for (let i = 0; i < 4; i++) assert.equal((await read(admin)).status, 200, `citirea ${i + 1}`);
});
