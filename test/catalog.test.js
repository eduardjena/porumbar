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

test('catalogul public', async () => {
  const r = await call('/api/catalog', { auth: 'none' });
  assert.equal(r.status, 200);
  assert.equal(r.data.breeds[0].code, 'voiajor');
  assert.ok(r.data.colors.length >= 10);
  assert.ok(r.data.colors.every((c) => !('synonyms' in c)));
  for (const k of ['eyeColors', 'statuses', 'evalCriteria', 'journalTypes']) assert.ok(r.data[k].length > 0, k);
});
