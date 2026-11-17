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

const mk = async (ring, extra = {}, cookie = a) => {
  const r = await call('/api/pigeons', { method: 'POST', cookie, body: { kind: 'own', ring, ...extra } });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  return r.data.pigeon;
};
const parents = (id, fatherId, motherId, cookie = a) =>
  call(`/api/pigeons/${id}/parents`, { method: 'PUT', cookie, body: { fatherId, motherId } });

let tata;
let mama;
let alta;
let pui = [];

test('părinții se aleg, iar sexul lipsă se completează', async () => {
  tata = await mk('RO-20-100001');
  mama = await mk('RO-20-100002', { sex: 'F' });
  alta = await mk('RO-20-100003', { sex: 'F' });
  for (let i = 0; i < 3; i++) pui.push(await mk(`RO-24-20000${i}`));
  for (const p of pui) {
    const r = await parents(p.id, tata.id, mama.id);
    assert.equal(r.status, 200, JSON.stringify(r.data));
    assert.equal(r.data.pigeon.fatherId, tata.id);
  }
  const t = await call(`/api/pigeons/${tata.id}`, { cookie: a });
  assert.equal(t.data.pigeon.sex, 'M');
  const semi = await mk('RO-24-300000');
  assert.equal((await parents(semi.id, tata.id, alta.id)).status, 200);
  pui.push(semi);
});

test('căutarea după inel arată istoricul (cardul)', async () => {
  for (const q of ['RO-20-100001', '100001/20 RO']) {
    const r = await call(`/api/pigeons/lookup?ring=${encodeURIComponent(q)}`, { cookie: a });
    assert.equal(r.status, 200);
    assert.equal(r.data.ring.display, 'RO-20-100001');
    assert.equal(r.data.matches.length, 1);
    assert.equal(r.data.matches[0].pigeon.id, tata.id);
    assert.equal(r.data.matches[0].offspringCount, 4);
    assert.equal(r.data.matches[0].offspring.length, 4);
  }
  const none = await call('/api/pigeons/lookup?ring=RO-20-999999', { cookie: a });
  assert.equal(none.data.matches.length, 0);
  const other = await call('/api/pigeons/lookup?ring=RO-20-100001', { cookie: b });
  assert.equal(other.data.matches.length, 0, 'alt cont nu vede');
  const text = await call(`/api/pigeons/lookup?ring=${encodeURIComponent('Govaerts')}`, { cookie: a });
  assert.equal(text.data.ring.ok, false);
});

test('erori la alegerea părinților (Review Focus 3)', async () => {
  const self = await parents(tata.id, tata.id, null);
  assert.equal(self.status, 400);
  assert.equal(self.data.error, 'Un porumbel nu poate fi propriul părinte.');
  const cycle = await parents(tata.id, pui[0].id, null);
  assert.equal(cycle.status, 400);
  assert.equal(cycle.data.error, 'Porumbelul ales e deja urmașul acestui porumbel.');
  const female = await parents(pui[0].id, mama.id, null);
  assert.equal(female.status, 400);
  assert.equal(female.data.error, 'Tatăl trebuie să fie mascul.');
  const male = await parents(pui[0].id, null, tata.id);
  assert.equal(male.status, 400);
  assert.equal(male.data.error, 'Mama trebuie să fie femelă.');
  const foreign = await mk('RO-20-500000', {}, b);
  assert.equal((await parents(pui[0].id, foreign.id, mama.id)).status, 404);
  assert.equal((await parents(pui[0].id, tata.id, mama.id, b)).status, 404);
});

test('rudele', async () => {
  const r = await call(`/api/pigeons/${pui[0].id}/family`, { cookie: a });
  assert.equal(r.status, 200);
  assert.equal(r.data.father.id, tata.id);
  assert.equal(r.data.mother.id, mama.id);
  assert.equal(r.data.fullSiblings.length, 2);
  assert.equal(r.data.halfSiblings.length, 1);
  assert.equal(r.data.offspring.length, 0);
  const t = await call(`/api/pigeons/${tata.id}/family`, { cookie: a });
  assert.equal(t.data.offspring.length, 4);
  assert.equal((await call(`/api/pigeons/${pui[0].id}/family`, { cookie: b })).status, 404);
});

test('arborele cu repetări și consangvinizarea', async () => {
  // Nepotul din doi frați buni: bunicii apar pe ambele linii.
  const nepot = await mk('RO-26-700000');
  const fiica = await mk('RO-24-200009', { sex: 'F' });
  assert.equal((await parents(fiica.id, tata.id, mama.id)).status, 200);
  assert.equal((await parents(nepot.id, pui[0].id, fiica.id)).status, 200);
  const t = await call(`/api/pigeons/${nepot.id}/tree?generations=4`, { cookie: a });
  assert.equal(t.status, 200);
  const { tree, pigeons } = t.data;
  assert.equal(tree.father.father.id, tata.id);
  assert.equal(tree.mother.father.id, tata.id);
  assert.notEqual(tree.father.father.repeat, null);
  assert.equal(tree.father.father.repeat, tree.mother.father.repeat);
  assert.equal(pigeons[tata.id].ring.display, 'RO-20-100001');
  const coi = await call(`/api/pigeons/${nepot.id}/coi`, { cookie: a });
  assert.equal(coi.data.coi, 0.25);
  assert.deepEqual(coi.data.common.map((c) => c.pigeon.id).sort(), [tata.id, mama.id].sort());
  const pair = await call(`/api/pairs/coi?sireId=${pui[0].id}&damId=${fiica.id}`, { cookie: a });
  assert.equal(pair.data.coi, 0.25);
  assert.equal((await call(`/api/pigeons/${nepot.id}/tree`, { cookie: b })).status, 404);
  assert.equal((await call(`/api/pigeons/${nepot.id}/coi`, { cookie: b })).status, 404);
  assert.equal((await call(`/api/pairs/coi?sireId=${pui[0].id}&damId=${fiica.id}`, { cookie: b })).status, 404);
  assert.equal((await call(`/api/pigeons/${nepot.id}/tree?generations=11`, { cookie: a })).status, 400);
});

test('arborele are pentru fiecare porumbel tot ce e pe fișa tipărită: culoarea, crescătorul, rezultatele și textul', async () => {
  const tataF = await mk('RO-21-310001', { color: 'albastru', colorPa: true, breederText: 'Ionescu Petre', pedigreeText: 'Tatăl campionilor' });
  const puiF = await mk('RO-25-310002', { colorText: 'Solzat închis', sex: 'F' });
  assert.equal((await parents(puiF.id, tataF.id, null)).status, 200);
  const race = { number: 1, organizer: 'Vâlcea', category: 'viteza', date: '2026-05-04', releasePlace: 'Yablanița', releaseTime: '08:01', entered: 10023 };
  const r = await call(`/api/pigeons/${tataF.id}/results`, { method: 'POST', cookie: a, body: { race, place: 1, distanceKm: 196.608 } });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  const t = await call(`/api/pigeons/${puiF.id}/tree?generations=4`, { cookie: a });
  assert.equal(t.status, 200);
  const { pigeons } = t.data;
  assert.deepEqual(pigeons[tataF.id].sheet, { color: 'Albastru p.a.', breeder: 'Ionescu Petre', text: "1e-197KM-10023P-'26; Tatăl campionilor" });
  assert.deepEqual(pigeons[puiF.id].sheet, { color: 'Solzat închis', breeder: null, text: null });
});
