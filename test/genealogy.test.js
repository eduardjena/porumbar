import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTree, wrightCoi, coiOf, ancestorIds } from '../src/genealogy.js';

/** g([id, father, mother], …) → Nodes */
const g = (...rows) => new Map(rows.map(([id, fatherId = null, motherId = null]) => [id, { id, fatherId, motherId }]));
const r = (x) => Math.round(x * 1e6) / 1e6;

test('frați buni', () => assert.equal(r(wrightCoi(3, 4, g([1], [2], [3, 1, 2], [4, 1, 2])).coi), 0.25));
test('semi-frați', () => assert.equal(r(wrightCoi(4, 5, g([1], [2], [3], [4, 1, 2], [5, 1, 3])).coi), 0.125));
test('tată × fiică', () => assert.equal(r(wrightCoi(1, 3, g([1], [2], [3, 1, 2])).coi), 0.25));
test('veri primari', () =>
  assert.equal(r(wrightCoi(7, 8, g([1], [2], [3, 1, 2], [4, 1, 2], [5], [6], [7, 3, 5], [8, 4, 6])).coi), 0.0625));
test('strămoș comun el însuși consangvin', () => {
  // A=5 e pui de frați buni (F_A = 0.25); 6 și 7 sunt semi-frați prin A → 0.125 · 1.25
  const nodes = g([1], [2], [3, 1, 2], [4, 1, 2], [5, 3, 4], [8], [9], [6, 5, 8], [7, 5, 9]);
  assert.equal(r(wrightCoi(6, 7, nodes).coi), 0.15625);
});
test('strămoșii comuni, cu contribuția lor', () => {
  const res = wrightCoi(3, 4, g([1], [2], [3, 1, 2], [4, 1, 2]));
  assert.deepEqual(res.common.map((c) => c.id).sort(), [1, 2]);
  assert.equal(r(res.common[0].contribution), 0.125);
});
test('fără strămoși comuni', () => assert.equal(wrightCoi(1, 2, g([1], [2])).coi, 0));
test('părinte lipsă', () => assert.deepEqual(coiOf(3, g([1], [3, 1, null])), { coi: 0, common: [] }));
test('coiOf = consangvinizarea porumbelului din părinții lui', () =>
  assert.equal(r(coiOf(5, g([1], [2], [3, 1, 2], [4, 1, 2], [5, 3, 4])).coi), 0.25));
test('ciclu în date nu blochează', () => {
  const res = wrightCoi(1, 2, g([1, 2, null], [2, 1, null]));
  assert.equal(typeof res.coi, 'number');
  assert.ok(Number.isFinite(res.coi));
});
test('arbore cu repetări', () => {
  const t = buildTree(7, g([1], [2], [3, 1, 2], [4, 1, 2], [5], [6], [7, 3, 4]), 3);
  assert.equal(t.id, 7);
  assert.equal(t.father.father.id, 1);
  assert.equal(t.father.father.repeat, t.mother.father.repeat);
  assert.notEqual(t.father.father.repeat, null);
  assert.notEqual(t.father.mother.repeat, t.father.father.repeat);
  assert.equal(t.father.repeat, null);
});
test('arborele se oprește la numărul de generații și la cicluri', () => {
  const t = buildTree(3, g([1], [2], [3, 1, 2]), 0);
  assert.equal(t.father, null);
  const c = buildTree(1, g([1, 2, null], [2, 1, null]), 5);
  assert.equal(c.father.id, 2);
  assert.equal(c.father.father, null);
});
test('strămoșii unui porumbel', () => {
  assert.deepEqual([...ancestorIds(5, g([1], [2], [3, 1, 2], [4], [5, 3, 4]))].sort(), [1, 2, 3, 4]);
});
