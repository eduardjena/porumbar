import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { apiCaller } from './helpers/api.js';
import { startTestApp } from './helpers/db.js';
import { newAccount } from './helpers/accounts.js';

let server;
let base;
let a;
let b;
const call = apiCaller(() => ({ base }));
before(async () => {
  ({ server, base } = await startTestApp());
  a = await newAccount(call, 'A');
  b = await newAccount(call, 'B');
});
after(() => server?.close());

const create = (cookie, body) => call('/api/pigeons', { method: 'POST', cookie, body });
let first;

test('porumbel propriu: inelul se recunoaște, sexul vine din inel', async () => {
  const r = await create(a, { kind: 'own', ring: 'RO-26-800546 L', name: 'DE 546', color: 'albastru', status: 'tanar', lines: ['Popescu', ' popescu ', 'Van Heteren'] });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  first = r.data.pigeon;
  assert.equal(first.sex, 'M');
  assert.equal(first.ring.display, 'RO-26-800546');
  assert.equal(first.ring.raw, 'RO-26-800546 L');
  assert.equal(first.breed, 'voiajor');
  assert.deepEqual(first.lines, ['Popescu', 'Van Heteren']);
});

test('același inel în altă formă e dublură (Review Focus 1)', async () => {
  const r = await create(a, { kind: 'own', ring: '800546/26 RO' });
  assert.equal(r.status, 409);
  assert.equal(r.data.error, 'Inelul RO-26-800546 este deja în porumbarul tău.');
  const other = await create(b, { kind: 'own', ring: 'RO 26 0800546' });
  assert.equal(other.status, 409);
  assert.equal(other.data.error, 'Inelul RO-26-800546 este deja în programul altui crescător.');
});

test('căutarea după inel în altă formă și după nume', async () => {
  const byRing = await call('/api/pigeons?q=0800546', { cookie: a });
  assert.deepEqual(byRing.data.pigeons.map((p) => p.id), [first.id]);
  const byForm = await call(`/api/pigeons?q=${encodeURIComponent('800546/26 RO')}`, { cookie: a });
  assert.deepEqual(byForm.data.pigeons.map((p) => p.id), [first.id]);
  const byName = await call('/api/pigeons?q=de%20546', { cookie: a });
  assert.deepEqual(byName.data.pigeons.map((p) => p.id), [first.id]);
  assert.equal((await call('/api/pigeons?q=800546', { cookie: b })).data.pigeons.length, 0);
});

test('strămoși fără inel și cu inel necitit (Review Focus 2)', async () => {
  const x = await create(a, { kind: 'external', ring: '000 M', breederText: 'Govaerts, pedigreu distrus' });
  const y = await create(a, { kind: 'external', ring: '0000/07 RO M', colorText: 'Vanat', pedigreeText: 'A fost neinelat' });
  assert.equal(x.status, 201, JSON.stringify(x.data));
  assert.equal(y.status, 201, JSON.stringify(y.data));
  assert.equal(x.data.pigeon.sex, 'M');
  const z = await create(a, { kind: 'external', ring: 'Latebred BasVK??' });
  assert.equal(z.status, 201);
  assert.equal(z.data.pigeon.ring.display, 'Latebred BasVK??');
  const own = await create(a, { kind: 'own', ring: 'Latebred' });
  assert.equal(own.status, 400);
  assert.equal(own.data.error, 'Inelul nu poate fi citit. Scrie-l ca în exemplu: RO-25-123456.');
});

test('strămoș extern dublat în același cont', async () => {
  assert.equal((await create(a, { kind: 'external', ring: 'NL-11-1724956' })).status, 201);
  const dup = await create(a, { kind: 'external', ring: '1724956/11 NL' });
  assert.equal(dup.status, 409);
  assert.equal((await create(b, { kind: 'external', ring: 'NL-11-1724956' })).status, 201, 'alt cont își are strămoșii lui');
});

test('valori invalide', async () => {
  assert.equal((await create(a, { kind: 'own', ring: 'RO-25-1', color: 'inexistent' })).status, 400);
  assert.equal((await create(a, { kind: 'own', ring: 'RO-25-2', evaluation: { scores: { echilibru: 6 } } })).status, 400);
  assert.equal((await create(a, { kind: 'own', ring: 'RO-25-3', evaluation: { scores: { inventat: 3 } } })).status, 400);
  assert.equal((await create(a, { kind: 'own', ring: 'RO-25-4', hatchedOn: '2025-13-40' })).status, 400);
  assert.equal((await create(a, { kind: 'altceva', ring: 'RO-25-5' })).status, 400);
});

test('evaluarea se salvează', async () => {
  const r = await call(`/api/pigeons/${first.id}`, {
    method: 'PATCH',
    cookie: a,
    body: { evaluation: { scores: { echilibru: 5, aripa: 4 }, calitati: 'Musculatură bună', deDorit: '', defecte: 'Ochi deschis' } },
  });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.deepEqual(r.data.pigeon.evaluation.scores, { echilibru: 5, aripa: 4 });
  assert.equal(r.data.pigeon.evaluation.calitati, 'Musculatură bună');
  assert.equal(r.data.pigeon.name, 'DE 546', 'câmpurile netrimise rămân');
});

test('alt cont nu vede porumbelul (Review Focus 4)', async () => {
  assert.equal((await call(`/api/pigeons/${first.id}`, { cookie: b })).status, 404);
  assert.equal((await call(`/api/pigeons/${first.id}`, { method: 'PATCH', cookie: b, body: { name: 'x' } })).status, 404);
  assert.equal((await call(`/api/pigeons/${first.id}`, { method: 'DELETE', cookie: b })).status, 404);
  assert.equal((await call(`/api/pigeons/${first.id}`, { auth: 'none' })).status, 401);
});

test('filtrele listei', async () => {
  const r = await call('/api/pigeons?kind=own&sex=M&year=2026', { cookie: a });
  assert.deepEqual(r.data.pigeons.map((p) => p.id), [first.id]);
  assert.ok((await call('/api/pigeons?kind=external', { cookie: a })).data.pigeons.every((p) => p.kind === 'external'));
});

test('un porumbel care e părinte nu se șterge', async () => {
  const child = await create(a, { kind: 'own', ring: 'RO-26-900001' });
  const { run } = await import('../src/db.js');
  await run('UPDATE pigeons SET father_id = ? WHERE id = ?', first.id, child.data.pigeon.id);
  const del = await call(`/api/pigeons/${first.id}`, { method: 'DELETE', cookie: a });
  assert.equal(del.status, 409);
  assert.equal(del.data.error, 'Porumbelul are pui în program. Schimbă-i starea în loc să-l ștergi.');
  assert.equal((await call(`/api/pigeons/${child.data.pigeon.id}`, { method: 'DELETE', cookie: a })).status, 204);
});
