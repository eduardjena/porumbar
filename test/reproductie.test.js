import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { apiCaller } from './helpers/api.js';
import { startTestApp } from './helpers/db.js';
import { newAccount } from './helpers/accounts.js';

let server;
let base;
let a;
let b;
let cock;
let hen;
let hen2;
let pairId;
let clutchId;
const call = apiCaller(() => ({ base }));
const own = async (ring, sex, cookie = a) => (await call('/api/pigeons', { method: 'POST', cookie, body: { kind: 'own', ring, sex } })).data.pigeon;

before(async () => {
  ({ server, base } = await startTestApp());
  a = await newAccount(call, 'A');
  b = await newAccount(call, 'B');
  cock = await own('RO-24-100001', 'M');
  hen = await own('RO-24-100002', 'F');
  hen2 = await own('RO-23-100003', 'F');
});
after(() => server?.close());

test('perechea nouă: masculul și femela contului, pe sezonul datei de împerechere', async () => {
  const r = await call('/api/pairs', { method: 'POST', cookie: a, body: { cockId: cock.id, henId: hen.id, pairedOn: '2026-02-10', nest: '12' } });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  pairId = r.data.pair.id;
  assert.equal(r.data.pair.season, 2026);
  assert.equal(r.data.pair.status, 'activa');
  assert.equal(r.data.pair.cock.id, cock.id);
  assert.equal(r.data.pair.hen.id, hen.id);
  assert.equal(r.data.pair.nest, '12');
  const again = await call('/api/pairs', { method: 'POST', cookie: a, body: { cockId: cock.id, henId: hen.id, pairedOn: '2026-03-01' } });
  assert.equal(again.status, 409, 'aceeași pereche de două ori în același sezon');
});

test('perechea plănuită (fără dată) și refuzurile', async () => {
  const planned = await call('/api/pairs', { method: 'POST', cookie: a, body: { cockId: cock.id, henId: hen2.id, season: 2026 } });
  assert.equal(planned.status, 201, JSON.stringify(planned.data));
  assert.equal(planned.data.pair.status, 'planificata');
  assert.equal((await call('/api/pairs', { method: 'POST', cookie: a, body: { cockId: hen.id, henId: hen2.id, pairedOn: '2026-02-10' } })).status, 400, 'masculul trebuie să fie mascul');
  assert.equal((await call('/api/pairs', { method: 'POST', cookie: a, body: { cockId: cock.id, henId: cock.id, pairedOn: '2026-02-10' } })).status, 400);
  assert.equal((await call('/api/pairs', { method: 'POST', cookie: a, body: { cockId: cock.id, henId: hen.id, pairedOn: '2026-02-31' } })).status, 400);
  const foreign = await own('RO-24-900001', 'F', b);
  assert.equal((await call('/api/pairs', { method: 'POST', cookie: a, body: { cockId: cock.id, henId: foreign.id, pairedOn: '2026-02-10' } })).status, 404, 'porumbelul altui cont nu se vede');
  const list = (await call('/api/pairs?season=2026', { cookie: a })).data.pairs;
  assert.equal(list.length, 2);
  assert.equal((await call('/api/pairs?season=2026', { cookie: b })).data.pairs.length, 0);
  await call(`/api/pairs/${planned.data.pair.id}`, { method: 'DELETE', cookie: a });
});

test('ponta: eclozarea așteptată și inelarea se calculează', async () => {
  const r = await call(`/api/pairs/${pairId}/clutches`, { method: 'POST', cookie: a, body: { egg1On: '2026-02-20', egg2On: '2026-02-22' } });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  clutchId = r.data.clutch.id;
  assert.equal(r.data.clutch.eggs, 2);
  assert.deepEqual(r.data.clutch.expectedHatch, { from: '2026-03-09', to: '2026-03-11' });
  assert.equal(r.data.clutch.ringFrom, null, 'fără eclozare încă nu se inelează');
  const h = await call(`/api/clutches/${clutchId}`, { method: 'PATCH', cookie: a, body: { hatchedOn: '2026-03-10', hatched: 2, infertile: 0 } });
  assert.equal(h.status, 200, JSON.stringify(h.data));
  assert.deepEqual([h.data.clutch.ringFrom, h.data.clutch.ringTo], ['2026-03-16', '2026-03-18']);
  assert.equal((await call(`/api/clutches/${clutchId}`, { method: 'PATCH', cookie: a, body: { hatchedOn: '2026-02-19' } })).status, 400, 'nu iese înainte de ou');
  assert.equal((await call(`/api/clutches/${clutchId}`, { method: 'PATCH', cookie: a, body: { hatched: 3 } })).status, 400, 'mai mulți pui decât ouă');
  assert.equal((await call(`/api/clutches/${clutchId}`, { method: 'PATCH', cookie: b, body: { hatched: 1 } })).status, 404);
});

test('seria de inele propune inelul următor liber', async () => {
  const s = await call('/api/ring-series', { method: 'POST', cookie: a, body: { first: 'RO-26-800540', last: 'RO-26-800589' } });
  assert.equal(s.status, 201, JSON.stringify(s.data));
  assert.equal(s.data.series.count, 50);
  await own('RO-26-800540', null);
  assert.equal((await call('/api/ring-series/next?year=2026', { cookie: a })).data.ring, 'RO-26-800541');
  assert.equal((await call('/api/ring-series', { method: 'POST', cookie: a, body: { first: 'RO-26-800589', last: 'RO-26-800540' } })).status, 400);
  assert.equal((await call('/api/ring-series', { method: 'POST', cookie: a, body: { first: 'RO-26-1', last: 'RO-26-5000' } })).status, 400, 'cel mult 1000 de inele într-o serie');
  assert.equal((await call('/api/ring-series/next?year=2026', { cookie: b })).data.ring, null);
});

test('inelarea puiului: porumbel nou cu părinții perechii, legat de pontă', async () => {
  const r = await call(`/api/clutches/${clutchId}/young`, { method: 'POST', cookie: a, body: { ring: 'RO-26-800541' } });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  const young = r.data.pigeon;
  assert.equal(young.kind, 'own');
  assert.equal(young.status, 'tanar');
  assert.equal(young.hatchedOn, '2026-03-10');
  const fam = (await call(`/api/pigeons/${young.id}/family`, { cookie: a })).data;
  assert.equal(fam.father.id, cock.id);
  assert.equal(fam.mother.id, hen.id);
  const pair = (await call(`/api/pairs/${pairId}`, { cookie: a })).data.pair;
  assert.equal(pair.clutches[0].young.length, 1);
  assert.equal(pair.clutches[0].young[0].id, young.id);
  assert.equal((await call('/api/ring-series/next?year=2026', { cookie: a })).data.ring, 'RO-26-800542');
  assert.equal((await call(`/api/clutches/${clutchId}/young`, { method: 'POST', cookie: a, body: { ring: 'RO-26-800541' } })).status, 409, 'inelul e deja folosit');
  await call(`/api/clutches/${clutchId}/young`, { method: 'POST', cookie: a, body: { ring: 'RO-26-800542', sex: 'F' } });
  assert.equal((await call(`/api/clutches/${clutchId}/young`, { method: 'POST', cookie: a, body: { ring: 'RO-26-800543' } })).status, 400, 'mai mulți pui decât au ieșit');
});

test('perechea are consangvinizarea, numărul de ponte și de pui; ștergerea lasă puii', async () => {
  const list = (await call('/api/pairs?season=2026', { cookie: a })).data.pairs;
  const p = list.find((x) => x.id === pairId);
  assert.equal(p.clutchCount, 1);
  assert.equal(p.youngCount, 2);
  assert.equal(typeof p.coi, 'number');
  assert.equal((await call(`/api/pairs/${pairId}`, { method: 'DELETE', cookie: b })).status, 404);
  assert.equal((await call(`/api/pairs/${pairId}`, { method: 'DELETE', cookie: a })).status, 204);
  const young = (await call('/api/pigeons?q=RO-26-800541', { cookie: a })).data.pigeons;
  assert.equal(young.length, 1, 'puiul rămâne');
});
