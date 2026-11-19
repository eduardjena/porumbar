import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { apiCaller } from './helpers/api.js';
import { startTestApp } from './helpers/db.js';
import { adminCookie, newAccount, today } from './helpers/accounts.js';

// În primele 14 zile ale unui abonament (cât ține dreptul de retragere) se pot face doar 3 citiri din poze; apoi toate
// cele 100 pe an. Altfel cineva ar putea plăti, citi 100 de fișe și se retrage (iar și iar, cu alt cont).
let server;
let base;
let admin;
let reader;
const call = apiCaller(() => ({ base }));
const me = async (cookie) => (await call('/api/auth/me', { cookie })).data.account;
const photo = { mime: 'image/png', data: Buffer.from('x').toString('base64') };
const read = (cookie) => call('/api/pedigrees/read', { method: 'POST', cookie, body: photo });
const plusDays = (iso, n) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const idOf = async (cookie) => (await me(cookie)).id;
const startOn = (id, start) => call(`/api/admin/accounts/${id}/subscription`, { method: 'POST', cookie: admin, body: { start } });

before(async () => {
  delete process.env.PEDIGREE_READS_PER_YEAR;
  delete process.env.PEDIGREE_READS_FIRST_DAYS;
  ({ server, base } = await startTestApp());
  admin = await adminCookie(call);
  reader = await import('../src/pedigree-reader.js');
  reader.setPedigreeModel(async () => ({
    slots: [{ slot: 1, ring: 'RO-20-1' }],
    rootSex: null,
    notes: '',
    usage: { input_tokens: 1000, output_tokens: 1000 },
  }));
});
after(() => {
  reader?.setPedigreeModel(null);
  server?.close();
});

test('abonament nou: 3 citiri în primele 14 zile, apoi mesaj clar cu ziua de la care le are pe toate', async () => {
  const c = await newAccount(call, 'Nou');
  const from = plusDays(today(), 14);
  assert.deepEqual((await me(c)).reads, { used: 0, allowed: 3, perYear: 100, fullFrom: from });
  for (let i = 0; i < 3; i++) assert.equal((await read(c)).status, 200, `citirea ${i + 1}`);
  const over = await read(c);
  assert.equal(over.status, 402);
  assert.match(over.data.error, /primele 14 zile/);
  assert.match(over.data.error, /3 citiri/);
  const [y, m, d] = from.split('-');
  assert.ok(over.data.error.includes(`${Number(d)}.${m}.${y}`) || over.data.error.includes(`${d}.${m}.${y}`), over.data.error);
});

test('după 14 zile de abonament: toate cele 100 pe an', async () => {
  const c = await newAccount(call, 'Vechi');
  assert.equal((await startOn(await idOf(c), plusDays(today(), -14))).status, 200);
  assert.deepEqual((await me(c)).reads, { used: 0, allowed: 100, perYear: 100, fullFrom: null });
  for (let i = 0; i < 4; i++) assert.equal((await read(c)).status, 200, `citirea ${i + 1}`);
});

test('ziua 13 e încă în primele 14 zile', async () => {
  const c = await newAccount(call, 'Ziua13');
  await startOn(await idOf(c), plusDays(today(), -13));
  assert.equal((await me(c)).reads.allowed, 3);
});

test('citirile în plus date de vânzător se adaugă și în primele 14 zile', async () => {
  const c = await newAccount(call, 'Plus');
  const id = await idOf(c);
  const r = await call(`/api/admin/accounts/${id}/reads`, { method: 'POST', cookie: admin, body: { amount: 5, note: 'client cunoscut' } });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.account.reads.allowed, 8);
  assert.equal(r.data.account.reads.fullFrom, plusDays(today(), 14));
});

test('numărul din primele zile se poate schimba din variabile (PEDIGREE_READS_FIRST_DAYS)', async () => {
  process.env.PEDIGREE_READS_FIRST_DAYS = '10';
  try {
    const c = await newAccount(call, 'Zece');
    assert.equal((await me(c)).reads.allowed, 10);
  } finally {
    delete process.env.PEDIGREE_READS_FIRST_DAYS;
  }
});

test('dacă limita pe an e cât cea din primele zile (sau mai mică), nu se mai vorbește de primele 14 zile', async () => {
  process.env.PEDIGREE_READS_PER_YEAR = '3';
  try {
    const c = await newAccount(call, 'Egal');
    assert.deepEqual((await me(c)).reads, { used: 0, allowed: 3, perYear: 3, fullFrom: null });
  } finally {
    delete process.env.PEDIGREE_READS_PER_YEAR;
  }
});
