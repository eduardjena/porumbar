import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { bloodlines, roundPercents } from '../src/bloodlines.js';
import { apiCaller } from './helpers/api.js';
import { startTestApp } from './helpers/db.js';
import { newAccount } from './helpers/accounts.js';

/** rows(...[id, father, mother, lines, breeder]) → Map<id, row> (forma rândurilor din bază). */
const rows = (...list) =>
  new Map(list.map(([id, father_id = null, mother_id = null, lines = [], breeder_text = null]) => [id, { id, father_id, mother_id, lines, breeder_text }]));
const pct = (r, name) => r.lines.find((l) => l.name === name)?.percent;
const total = (r) => Math.round(r.lines.reduce((s, l) => s + l.percent, 0) * 1e6) / 1e6;

test('părinți din linii diferite: 50 / 50', () => {
  const r = bloodlines(3, rows([1, null, null, ['Janssen']], [2, null, null, ['Van Loon']], [3, 1, 2]));
  assert.equal(pct(r, 'Janssen'), 50);
  assert.equal(pct(r, 'Van Loon'), 50);
  assert.equal(total(r), 100);
});

test('un părinte lipsă: jumătate „Necunoscut” (Review Focus 1)', () => {
  const r = bloodlines(2, rows([1, null, null, ['Janssen']], [2, 1, null]));
  assert.equal(pct(r, 'Janssen'), 50);
  assert.equal(pct(r, 'Necunoscut'), 50);
  assert.ok(r.paths.some((p) => p.founderId === null && p.line === 'Necunoscut'));
});

test('strămoș comun pe trei drumuri se adună (Review Focus 2)', () => {
  // 9 = „De 746” (Den Haan): bunică pe partea tatălui (adâncime 2) și străbunică de două ori pe partea mamei (adâncime 3).
  const data = rows(
    [9, null, null, ['Den Haan']],
    [8, null, null, ['Van Heteren']],
    [7, null, null, ['Alta']],
    [5, 8, 9], // tatăl
    [4, 7, 9], // bunicul pe partea mamei
    [3, 7, 9], // bunica pe partea mamei
    [6, 4, 3], // mama
    [1, 5, 6], // porumbelul
  );
  const r = bloodlines(1, data);
  assert.equal(pct(r, 'Den Haan'), 50); // 1/4 prin tată + 1/8 + 1/8 prin mamă
  assert.equal(pct(r, 'Van Heteren'), 25);
  assert.equal(pct(r, 'Alta'), 25);
  assert.equal(r.lines.find((l) => l.name === 'Den Haan').founders.length, 1);
  assert.equal(r.paths.filter((p) => p.founderId === 9).length, 3);
  assert.equal(total(r), 100);
  const viaFather = r.paths.find((p) => p.founderId === 9 && p.via.includes(5));
  assert.deepEqual(viaFather.via, [9, 5, 1]);
});

test('fondator fără linie: crescătorul, altfel „Fără linie” (Review Focus 3)', () => {
  const r = bloodlines(3, rows([1, null, null, [], 'Govaerts'], [2], [3, 1, 2]));
  assert.equal(pct(r, 'Govaerts'), 50);
  assert.equal(pct(r, 'Fără linie'), 50);
});

test('procentele rotunjite dau mereu 100 (nu 99,99)', () => {
  const shares = [0.00390625, 0.00390625, 0.00390625, 0.00390625, 0.0078125, 0.0078125, 0.0078125, 0.0078125, 0.953125];
  const p = roundPercents(shares);
  assert.equal(Math.round(p.reduce((s, x) => s + x, 0) * 100) / 100, 100);
  assert.ok(p.every((x, i) => Math.abs(x - shares[i] * 100) < 0.02));
});

test('ciclu în date nu blochează (Review Focus 5)', () => {
  const r = bloodlines(1, rows([1, 2, null], [2, 1, null]));
  assert.equal(typeof total(r), 'number');
});

let server;
let base;
const call = apiCaller(() => ({ base }));
before(async () => ({ server, base } = await startTestApp()));
after(() => server?.close());

test('ruta: procentele și porumbeii de pe drumuri; alt cont → 404', async () => {
  const a = await newAccount(call, 'A');
  const b = await newAccount(call, 'B');
  const mk = async (ring, extra) => (await call('/api/pigeons', { method: 'POST', cookie: a, body: { kind: 'external', ring, ...extra } })).data.pigeon;
  const t = await mk('NL-10-1', { lines: ['Janssen'] });
  const m = await mk('NL-10-2', { breederText: 'Van Loon' });
  const p = (await call('/api/pigeons', { method: 'POST', cookie: a, body: { kind: 'own', ring: 'RO-20-1' } })).data.pigeon;
  await call(`/api/pigeons/${p.id}/parents`, { method: 'PUT', cookie: a, body: { fatherId: t.id, motherId: m.id } });
  const r = await call(`/api/pigeons/${p.id}/bloodlines`, { cookie: a });
  assert.equal(r.status, 200);
  assert.deepEqual(r.data.lines.map((l) => [l.name, l.percent]).sort(), [['Janssen', 50], ['Van Loon', 50]]);
  assert.equal(r.data.pigeons[t.id].ring.display, 'NL-10-1');
  assert.equal((await call(`/api/pigeons/${p.id}/bloodlines`, { cookie: b })).status, 404);
});
