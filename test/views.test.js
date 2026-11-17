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

test('panoul are pentru fiecare porumbel ce trebuie la ordonare și grupare: rezultate, pereche, generație, ce lipsește', async () => {
  const c = await newAccount(call, 'Bara');
  const mk = async (body) => {
    const r = await call('/api/pigeons', { method: 'POST', cookie: c, body: { kind: 'own', ...body } });
    assert.equal(r.status, 201, JSON.stringify(r.data));
    return r.data.pigeon;
  };
  const tata = await mk({ ring: 'RO-20-610001', sex: 'M', color: 'albastru', breederText: 'Herbots', lines: ['Janssen'] });
  const mama = await mk({ ring: 'RO-21-610002', sex: 'F', color: 'solzat', status: 'reproducator' });
  const fiu = await mk({ ring: 'RO-24-610003' });
  assert.equal((await call(`/api/pigeons/${fiu.id}/parents`, { method: 'PUT', cookie: c, body: { fatherId: tata.id, motherId: mama.id } })).status, 200);
  const nepot = await mk({ ring: 'RO-25-610004', sex: 'M', color: 'rosu' });
  assert.equal((await call(`/api/pigeons/${nepot.id}/parents`, { method: 'PUT', cookie: c, body: { fatherId: fiu.id, motherId: null } })).status, 200);
  // Două rezultate ale tatălui: locul 5 din 100 (premiat, în primii 20%) și locul 50 din 100 (fără premiu).
  const race = (n, date, category) => ({ number: n, organizer: 'Vâlcea', category, date, releasePlace: 'Yablanița', releaseTime: '08:00', entered: 100 });
  for (const [n, place, category] of [[1, 5, 'fond'], [2, 50, 'viteza']]) {
    const r = await call(`/api/pigeons/${tata.id}/results`, { method: 'POST', cookie: c, body: { race: race(n, `2026-05-0${n}`, category), place, distanceKm: 500 } });
    assert.equal(r.status, 201, JSON.stringify(r.data));
  }
  const singur = await mk({ ring: 'RO-26-610005' });
  const pair = (await call('/api/pairs', { method: 'POST', cookie: c, body: { cockId: tata.id, henId: mama.id, pairedOn: '2026-02-10' } })).data.pair;

  const clutch = (await call(`/api/pairs/${pair.id}/clutches`, { method: 'POST', cookie: c, body: { egg1On: '2026-02-20', egg2On: '2026-02-22' } })).data.clutch;
  const pui = await call(`/api/clutches/${clutch.id}/young`, { method: 'POST', cookie: c, body: { ring: 'RO-26-610009' } });
  assert.equal(pui.status, 201, JSON.stringify(pui.data));

  const board = (await call('/api/board', { cookie: c })).data.pigeons;
  const f = (p) => board.find((x) => x.id === p.id).facts;
  assert.deepEqual(f(tata).results, { count: 2, prizes: 1, bestPlace: 5, bestPenalty: 50, bestCategory: 'fond' });
  assert.equal(f(mama).results, null);
  assert.deepEqual(f(tata).pair, { id: pair.id, season: 2026, label: 'RO-20-610001 × RO-21-610002' });
  assert.equal(f(pui.data.pigeon).pair.id, pair.id, 'puiul inelat din pontă stă la perechea lui');
  assert.equal(f(tata).breeding, true, 'în perechea activă');
  assert.equal(f(mama).breeding, true, 'reproducătoare');
  assert.equal(f(fiu).breeding, false);
  assert.deepEqual([f(tata).loftGen, f(mama).loftGen, f(fiu).loftGen, f(nepot).loftGen], [1, 1, 2, 3]);
  assert.deepEqual(f(tata).missing, ['parinti'], 'fără părinți: de completat');
  assert.deepEqual(f(fiu).missing, ['culoare'], 'sexul i s-a pus când a devenit tată');
  assert.deepEqual(f(singur).missing, ['sex', 'culoare', 'parinti']);
  assert.deepEqual(f(nepot).missing, ['mama']);
  assert.equal(f(tata).breeder, 'Herbots');
  assert.deepEqual(f(tata).lines, ['Janssen']);
  assert.equal(f(tata).colorLabel, 'Albastru');
  assert.ok(f(tata).createdAt);
});
