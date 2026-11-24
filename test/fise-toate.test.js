import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { apiCaller } from './helpers/api.js';
import { startTestApp } from './helpers/db.js';
import { newAccount } from './helpers/accounts.js';

let server;
let base;
let a;
let b;
let p1;
let p2;
let p3;
let pB;
const call = apiCaller(() => ({ base }));
const make = async (cookie, ring) => {
  const r = await call('/api/pigeons', { method: 'POST', cookie, body: { kind: 'own', ring } });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  return r.data.id ?? r.data.pigeon?.id;
};
before(async () => {
  ({ server, base } = await startTestApp());
  a = await newAccount(call, 'Ion');
  b = await newAccount(call, 'Vasile');
  p1 = await make(a, 'RO-26-100001');
  p2 = await make(a, 'RO-26-100002');
  p3 = await make(a, 'RO-26-100003');
  pB = await make(b, 'RO-26-200001');
});
after(() => server?.close());

test('fișele vin în ordinea cerută, fără dubluri, fără porumbeii altora', async () => {
  const r = await call(`/api/sheets?ids=${p3},${p1},${p3},${pB},999999,abc`, { cookie: a });
  assert.equal(r.status, 200);
  assert.deepEqual(r.data.sheets.map((s) => s.id), [p3, p1]);
  assert.equal(r.data.sheets[0].pedigree.format, 'porumbar-pedigree');
  const one = await call(`/api/pigeons/${p3}/pedigree`, { cookie: a });
  assert.deepEqual(r.data.sheets[0].pedigree.root, one.data.root);
  assert.equal(r.data.sheets[0].url, null);
});
test('fișele: gol sau peste 200 → 400', async () => {
  assert.equal((await call('/api/sheets?ids=', { cookie: a })).status, 400);
  const many = Array.from({ length: 201 }, (_, i) => i + 1).join(',');
  const r = await call(`/api/sheets?ids=${many}`, { cookie: a });
  assert.equal(r.status, 400);
  assert.match(r.data.error, /200/);
});
test('cod QR pe toate: pornește lipsă, păstrează existent, sare peste ale altora', async () => {
  const before = (await call(`/api/pigeons/${p1}/public`, { method: 'POST', cookie: a })).data.url;
  const r = await call('/api/sheets/public', { method: 'POST', cookie: a, body: { ids: [p1, p2, pB] } });
  assert.equal(r.status, 200);
  assert.deepEqual(r.data.sheets.map((s) => s.id), [p1, p2]);
  assert.equal(r.data.sheets[0].url, before);
  assert.match(r.data.sheets[1].url, /\/p\/[A-Za-z0-9_-]{20,}$/);
  assert.equal((await call(`/api/pigeons/${pB}/public`, { cookie: b })).data.url, null);
});
test('doar citire: fișele se văd, codul QR nu se pornește (402)', async () => {
  const c = await newAccount(call, 'Nou', { active: false });
  const g = await call(`/api/sheets?ids=${p1}`, { cookie: c }); // GET merge; p1 e al lui a, deci lista e goală
  assert.equal(g.status, 200);
  assert.deepEqual(g.data.sheets, []);
  assert.equal((await call('/api/sheets/public', { method: 'POST', cookie: c, body: { ids: [p1] } })).status, 402);
});
