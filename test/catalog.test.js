import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { matchColor } from '../src/catalog.js';
import { apiCaller } from './helpers/api.js';
import { startTestApp } from './helpers/db.js';

let server;
let base;
before(async () => ({ server, base } = await startTestApp()));
after(() => server?.close());
const call = apiCaller(() => ({ base }));
const pick = ({ code, pa }) => ({ code, pa });

test('culori din pedigree-urile reale', () => {
  assert.deepEqual(pick(matchColor('Vnata')), { code: 'vanat', pa: false });
  assert.deepEqual(pick(matchColor('Vânătă')), { code: 'vanat', pa: false });
  assert.deepEqual(pick(matchColor('Pestrita')), { code: 'pestrit', pa: false });
  assert.deepEqual(pick(matchColor('Albastra p.a')), { code: 'albastru', pa: true });
  assert.deepEqual(pick(matchColor('Solzat p.a')), { code: 'solzat', pa: true });
  assert.deepEqual(pick(matchColor('Albastru brocat')), { code: 'albastru-brocat', pa: false });
  assert.equal(matchColor('Albastra p.a Consangvina').rest.toLowerCase(), 'consangvina');
  assert.equal(matchColor('xyz').code, null);
});

test('dun (negru diluat) e altă culoare decât gălbui (roșu diluat); „dark” e solzat închis (spus de utilizator)', () => {
  assert.deepEqual(pick(matchColor('Dun')), { code: 'dun', pa: false });
  assert.deepEqual(pick(matchColor('Galben')), { code: 'galbui', pa: false });
  assert.deepEqual(pick(matchColor('Dark')), { code: 'solzat-inchis', pa: false });
});

test('abrevierile de pe pedigree-uri (românești și internaționale)', () => {
  assert.deepEqual(pick(matchColor('Gut')), { code: 'gut', pa: false });
  assert.deepEqual(pick(matchColor('Guta')), { code: 'gut', pa: false });
  assert.deepEqual(pick(matchColor('A')), { code: 'albastru', pa: false });
  assert.deepEqual(pick(matchColor('S')), { code: 'solzat', pa: false });
  assert.deepEqual(pick(matchColor('G')), { code: 'gut', pa: false });
  assert.deepEqual(pick(matchColor('R')), { code: 'rosu', pa: false });
  assert.deepEqual(pick(matchColor('Spa')), { code: 'solzat', pa: true });
  assert.deepEqual(pick(matchColor('b')), { code: 'baltat', pa: false });
  assert.deepEqual(pick(matchColor('BB')), { code: 'albastru', pa: false });
  assert.deepEqual(pick(matchColor('BC')), { code: 'solzat', pa: false });
  assert.deepEqual(pick(matchColor('Blue Check')), { code: 'solzat', pa: false });
  assert.deepEqual(pick(matchColor('DC')), { code: 'solzat-inchis', pa: false });
  assert.deepEqual(pick(matchColor('BC WF')), { code: 'solzat', pa: true });
  assert.deepEqual(pick(matchColor('PD')), { code: 'baltat', pa: false });
  assert.deepEqual(pick(matchColor('Pied')), { code: 'baltat', pa: false });
  assert.deepEqual(pick(matchColor('GRZ')), { code: 'tarcat', pa: false });
});

test('catalogul public', async () => {
  const r = await call('/api/catalog', { auth: 'none' });
  assert.equal(r.status, 200);
  assert.equal(r.data.breeds[0].code, 'voiajor');
  assert.ok(r.data.colors.length >= 10);
  assert.ok(r.data.colors.every((c) => !('synonyms' in c)));
  for (const k of ['eyeColors', 'statuses', 'evalCriteria', 'journalTypes']) assert.ok(r.data[k].length > 0, k);
});
