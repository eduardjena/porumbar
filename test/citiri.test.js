import { test, before, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { apiCaller } from './helpers/api.js';
import { startTestApp } from './helpers/db.js';
import { adminCookie, newAccount, today } from './helpers/accounts.js';

// Citirile din poze sunt incluse în abonament (docs/superpowers/specs/2026-11-18-citiri-incluse-design.md).
// Aici limita pe an e 3, ca testele să fie scurte (implicit 100); cu 3 pe an, limita din primele 14 zile (tot 3) nu
// mai schimbă nimic (test/citiri-inceput.test.js).
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
    usage: { input_tokens: 10_000, output_tokens: 5_000 }, // pe Sonnet: 0,02 $ + 0,05 $ = 0,07 $
  }));
});
afterEach(() => undefined);
after(() => {
  reader?.setPedigreeModel(null);
  server?.close();
});

test('un cont activat citește fără credit; la limita pe an se oprește cu mesaj clar', async () => {
  const c = await newAccount(call, 'Cititor');
  assert.deepEqual((await me(c)).reads, { used: 0, allowed: 3, perYear: 3, fullFrom: null });
  for (let i = 0; i < 3; i++) assert.equal((await read(c)).status, 200, `citirea ${i + 1}`);
  assert.deepEqual((await me(c)).reads, { used: 3, allowed: 3, perYear: 3, fullFrom: null });
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
  assert.deepEqual((await me(c)).reads, { used: 4, allowed: 5, perYear: 3, fullFrom: null });
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
  assert.deepEqual(row.reads, { used: 2, allowed: 3, perYear: 3, costUsd: 0.14, fullFrom: null }); // 2 × (10.000 × 2 + 5.000 × 10) µ$ pe Sonnet
  assert.equal(row.aiCredit, undefined, 'creditul nu mai există');
});

test('adminul (vânzătorul) citește fără limită pe an', async () => {
  for (let i = 0; i < 4; i++) assert.equal((await read(admin)).status, 200, `citirea ${i + 1}`);
});

test('citirea merge pe Sonnet (cererea „precise” nu mai schimbă nimic); răspunsul spune câte inele n-au ieșit clar', async () => {
  const c = await newAccount(call, 'Sonnet');
  const seen = [];
  reader.setPedigreeModel(async ({ model }) => {
    seen.push(model);
    return {
      slots: [{ slot: 1, ring: 'RO-20-1' }, { slot: 2, ring: 'mâzgălit' }, { slot: 3, ring: 'RO-19-7' }],
      rootSex: null,
      notes: '',
      usage: { input_tokens: 1000, output_tokens: 1000 },
    };
  });
  const r1 = await read(c);
  assert.equal(r1.status, 200, JSON.stringify(r1.data));
  assert.equal(r1.data.unclear, 1);
  assert.equal(r1.data.precise, undefined);
  const r2 = await call('/api/pedigrees/read', { method: 'POST', cookie: c, body: { ...photo, precise: true } });
  assert.equal(r2.status, 200, JSON.stringify(r2.data));
  assert.deepEqual(seen, ['claude-sonnet-5-5', 'claude-sonnet-5-5']);
  // 2 × 1000 × (2 + 10) microdolari = 0,024 $.
  const id = (await me(c)).id;
  const row = (await call('/api/admin/accounts', { cookie: admin })).data.accounts.find((x) => x.id === id);
  assert.equal(row.reads.used, 2);
  assert.equal(row.reads.costUsd, 0.02);
});

test('plafonul de bani pe an: peste el citirea se oprește', async () => {
  const prev = process.env.PEDIGREE_BUDGET_USD;
  process.env.PEDIGREE_BUDGET_USD = '0.15';
  try {
    const c = await newAccount(call, 'Plafon');
    reader.setPedigreeModel(async () => ({
      slots: [{ slot: 1, ring: 'RO-20-1' }],
      rootSex: null,
      notes: '',
      usage: { input_tokens: 50_000, output_tokens: 0 }, // 0,10 $ pe Sonnet
    }));
    assert.equal((await read(c)).status, 200);
    assert.equal((await read(c)).status, 200); // 0,10 $ < 0,15 $ la pornire
    const over = await read(c);
    assert.equal(over.status, 402);
    assert.match(over.data.error, /citiri/i);
  } finally {
    if (prev === undefined) delete process.env.PEDIGREE_BUDGET_USD;
    else process.env.PEDIGREE_BUDGET_USD = prev;
  }
});

test('fișă maghiară (model fals, fără credite): inelele cu asociație, ♂ / ♀, „HUN” și asociația fără zero se înțeleg', async () => {
  const c = await newAccount(call, 'Magyar');
  reader.setPedigreeModel(async () => ({
    slots: [
      { slot: 1, ring: 'HU-2023-23-46255 H', color: 'Kk' },
      { slot: 2, ring: 'HU24-04-41013 ♂', color: 'k.kov.' },
      { slot: 3, ring: 'HU-23-D-1234 T' },
      { slot: 4, ring: 'HUN-19-04-12345' },
      { slot: 5, ring: 'HU-2020-4-555 ♀' },
      { slot: 6, ring: 'NL-18-1234567 ♂' },
      { slot: 7, ring: 'HU24-04-41013 / Kk' }, // culoarea rămasă în inel: nu se acceptă, omul o vede
    ],
    rootSex: 'M',
    notes: '',
    usage: { input_tokens: 1000, output_tokens: 1000 },
  }));
  const r = await read(c);
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.filled, 7);
  assert.equal(r.data.unclear, 1, 'doar inelul cu „/ Kk” e neclar');
  assert.equal(r.data.root.father.ring, 'HU24-04-41013 ♂');
  assert.equal(r.data.root.color, 'Kk');
});

test('un cont doar citire (proba terminată) nu citește din poze: se oprește înainte de Claude, deci nu costă nimic', async () => {
  const c = await newAccount(call, 'Neplatit', { active: false });
  let called = 0;
  reader.setPedigreeModel(async () => {
    called++;
    return { slots: [{ slot: 1, ring: 'RO-20-1' }], rootSex: null, notes: '', usage: { input_tokens: 1, output_tokens: 1 } };
  });
  const r = await read(c);
  assert.equal(r.status, 402, JSON.stringify(r.data));
  assert.match(r.data.error, /Proba s-a terminat/);
  assert.equal(called, 0, 'cererea n-a ajuns la Claude');
  assert.equal((await me(c)).reads.used, 0);
});
