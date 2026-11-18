import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { apiCaller } from './helpers/api.js';
import { startTestApp } from './helpers/db.js';
import { newAccount, setIdentity } from './helpers/accounts.js';
import { PEDIGREE_FOTO } from './fixtures/pedigree-foto.js';

let server;
let base;
let a;
let b;
let fumur;
const call = apiCaller(() => ({ base }));
before(async () => {
  ({ server, base } = await startTestApp());
  a = await newAccount(call, 'Ion');
  b = await newAccount(call, 'Vasile');
  fumur = (await call('/api/pedigrees/import', { method: 'POST', cookie: a, body: { root: PEDIGREE_FOTO } })).data.pigeonId;
  await call(`/api/pigeons/${fumur}`, { method: 'PATCH', cookie: a, body: { name: 'FUMUR', status: 'reproducator', evaluation: { scores: { aripa: 5 }, calitati: 'secret' } } });
  const aId = (await call('/api/auth/me', { cookie: a })).data.account.id;
  await setIdentity(call, aId, { name: 'Ion', sheetName: 'Ion Team', phone: '0722 000 111', address: 'Str. Exemplu 1' });
});
after(() => server?.close());

const tokenOf = (url) => url.split('/p/')[1];
const publicGet = (token) => call(`/api/public/${token}`, { auth: 'none' });

test('ce apare pe pedigree: implicit doar numele; telefonul doar bifat', async () => {
  const me = await call('/api/auth/me', { cookie: a });
  assert.equal(me.data.account.showPhone, false);
  const on = await call(`/api/pigeons/${fumur}/public`, { method: 'POST', cookie: a });
  assert.equal(on.status, 200, JSON.stringify(on.data));
  let p = await publicGet(tokenOf(on.data.url));
  assert.deepEqual(Object.keys(p.data.owner), ['name']);
  await call('/api/auth/me', { method: 'PATCH', cookie: a, body: { showPhone: true } });
  p = await publicGet(tokenOf(on.data.url));
  assert.equal(p.data.owner.phone, '0722 000 111');
  assert.equal(p.data.owner.address, undefined);
  await call('/api/auth/me', { method: 'PATCH', cookie: a, body: { showPhone: false } });
});

test('linkul public: formatul deschis pe 5 generații, fără evaluare, stare sau jurnal', async () => {
  const on = await call(`/api/pigeons/${fumur}/public`, { method: 'POST', cookie: a });
  assert.match(on.data.url, /^http:\/\/localhost:3100\/p\/[A-Za-z0-9_-]{20,}$/);
  const again = await call(`/api/pigeons/${fumur}/public`, { method: 'POST', cookie: a });
  assert.equal(again.data.url, on.data.url); // pornit o dată, același link
  const p = await publicGet(tokenOf(on.data.url));
  assert.equal(p.status, 200);
  assert.equal(p.data.format, 'porumbar-pedigree');
  assert.equal(p.data.version, 1);
  assert.equal(p.data.root.ring, 'RO-15-412084');
  assert.equal(p.data.root.name, 'FUMUR');
  assert.equal(p.data.root.father.father.father.father.ring, 'NL-00-5027686');
  const json = JSON.stringify(p.data);
  for (const word of ['evaluation', 'secret', 'status', 'reproducator', 'journal', 'id"']) assert.ok(!json.includes(word), word);
  const state = await call(`/api/pigeons/${fumur}/public`, { cookie: a });
  assert.equal(state.data.url, on.data.url);
});

test('oprit sau înlocuit: vechiul link dă 404 imediat', async () => {
  const on = await call(`/api/pigeons/${fumur}/public`, { method: 'POST', cookie: a });
  const fresh = await call(`/api/pigeons/${fumur}/public/new`, { method: 'POST', cookie: a });
  assert.notEqual(fresh.data.url, on.data.url);
  assert.equal((await publicGet(tokenOf(on.data.url))).status, 404);
  assert.equal((await publicGet(tokenOf(fresh.data.url))).status, 200);
  assert.equal((await call(`/api/pigeons/${fumur}/public`, { method: 'DELETE', cookie: a })).status, 204);
  assert.equal((await publicGet(tokenOf(fresh.data.url))).status, 404);
  assert.equal((await call(`/api/pigeons/${fumur}/public`, { cookie: a })).data.url, null);
  assert.equal((await publicGet('nimic')).status, 404);
});

test('pedigree-ul pentru tipar: același format, doar pentru porumbeii contului', async () => {
  const mine = await call(`/api/pigeons/${fumur}/pedigree`, { cookie: a });
  assert.equal(mine.status, 200);
  assert.equal(mine.data.root.ring, 'RO-15-412084');
  assert.equal((await call(`/api/pigeons/${fumur}/pedigree`, { cookie: b })).status, 404);
});

test('alt cont nu poate porni linkul unui porumbel care nu e al lui', async () => {
  assert.equal((await call(`/api/pigeons/${fumur}/public`, { method: 'POST', cookie: b })).status, 404);
});

test('preluarea: pedigree-ul ajunge în contul celuilalt ca „din alt porumbar”, fără dubluri la a doua preluare', async () => {
  const on = await call(`/api/pigeons/${fumur}/public`, { method: 'POST', cookie: a });
  const token = tokenOf(on.data.url);
  const r = await call(`/api/public/${token}/import`, { method: 'POST', cookie: b });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  const mine = (await call(`/api/pigeons/${r.data.pigeonId}`, { cookie: b })).data.pigeon;
  assert.equal(mine.kind, 'external');
  assert.equal(mine.ring.display, 'RO-15-412084');
  assert.match(mine.sourceNote, /^Preluat de la Ion Team pe \d{2}\.\d{2}\.\d{4}$/);
  assert.equal(mine.evaluation.calitati ?? null, null);
  const t = (await call(`/api/pigeons/${r.data.pigeonId}/tree?generations=4`, { cookie: b })).data;
  assert.equal(Object.keys(t.pigeons).length >= 25, true);
  const again = await call(`/api/public/${token}/import`, { method: 'POST', cookie: b });
  assert.equal(again.data.pigeonId, r.data.pigeonId);
  assert.equal(again.data.created, 0);
});

test('preluarea ca porumbel propriu și cazurile greșite', async () => {
  const on = await call(`/api/pigeons/${fumur}/public`, { method: 'POST', cookie: a });
  const token = tokenOf(on.data.url);
  const c = await newAccount(call, 'Gheorghe');
  const own = await call(`/api/public/${token}/import`, { method: 'POST', cookie: c, body: { kind: 'own' } });
  assert.equal(own.status, 201);
  assert.equal((await call(`/api/pigeons/${own.data.pigeonId}`, { cookie: c })).data.pigeon.kind, 'own');
  assert.equal((await call(`/api/public/${token}/import`, { method: 'POST', cookie: a })).status, 400); // e al lui
  assert.equal((await call(`/api/public/${token}/import`, { method: 'POST', auth: 'none' })).status, 401);
  assert.equal((await call(`/api/public/nimic/import`, { method: 'POST', cookie: c })).status, 404);
});
