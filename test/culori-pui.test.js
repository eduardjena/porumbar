import { test } from 'node:test';
import assert from 'node:assert/strict';
import { predictColors, factorsFromColor, inferHidden } from '../src/color-genetics.js';

const pct = (list, name) => list.find((x) => x.name === name)?.pct ?? 0;

test('legat de sex: mascul albastru × femelă roșie → masculi roșii, femele albastre', () => {
  const r = predictColors(
    { sex: 'M', base: '+', pattern: '+', spread: false, dilute: false },
    { sex: 'F', base: 'BA', pattern: '+', spread: false, dilute: false },
  );
  assert.deepEqual(r.cocks.map((x) => [x.name, x.pct]), [['Roșu cu dungi', 100]]);
  assert.deepEqual(r.cocks[0].carries, ['albastru']);
  assert.deepEqual(r.hens.map((x) => [x.name, x.pct]), [['Albastru cu dungi', 100]]);
});

test('mascul roșu care poartă albastru × femelă albastră: jumătate roșii, jumătate albaștri la ambele sexe', () => {
  const r = predictColors(
    { sex: 'M', base: 'BA', baseHidden: '+', pattern: '+', spread: false, dilute: false },
    { sex: 'F', base: '+', pattern: '+', spread: false, dilute: false },
  );
  assert.equal(pct(r.cocks, 'Roșu cu dungi'), 50);
  assert.equal(pct(r.cocks, 'Albastru cu dungi'), 50);
  assert.equal(pct(r.hens, 'Roșu cu dungi'), 50);
  assert.equal(pct(r.hens, 'Albastru cu dungi'), 50);
});

test('desenul (autozomal): solzat care poartă dungi × cu dungi → 50% solzați, 50% cu dungi', () => {
  const r = predictColors(
    { sex: 'M', base: '+', pattern: 'C', patternHidden: '+', spread: false, dilute: false },
    { sex: 'F', base: '+', pattern: '+', spread: false, dilute: false },
  );
  assert.equal(pct(r.cocks, 'Albastru solzat'), 50);
  assert.equal(pct(r.cocks, 'Albastru cu dungi'), 50);
  assert.equal(pct(r.hens, 'Albastru solzat'), 50);
});

test('diluția legată de sex: mascul argintiu × femelă albastră → masculi albaștri (poartă diluția), femele argintii', () => {
  const r = predictColors(
    { sex: 'M', base: '+', pattern: '+', spread: false, dilute: true },
    { sex: 'F', base: '+', pattern: '+', spread: false, dilute: false },
  );
  assert.deepEqual(r.cocks.map((x) => [x.name, x.pct]), [['Albastru cu dungi', 100]]);
  assert.deepEqual(r.cocks[0].carries, ['diluție']);
  assert.deepEqual(r.hens.map((x) => [x.name, x.pct]), [['Argintiu cu dungi', 100]]);
});

test('negru uniform (spread) ascunde desenul', () => {
  const r = predictColors(
    { sex: 'M', base: '+', pattern: '+', spread: true, spreadHidden: false, dilute: false },
    { sex: 'F', base: '+', pattern: '+', spread: false, dilute: false },
  );
  assert.equal(pct(r.cocks, 'Negru'), 50);
  assert.equal(pct(r.cocks, 'Albastru cu dungi'), 50);
});

test('ce nu se știe nu se ghicește: locusul necunoscut e scos și spus', () => {
  const r = predictColors({ sex: 'M', base: '+', pattern: null, spread: false, dilute: false }, { sex: 'F', base: 'BA', pattern: '+', spread: false, dilute: false });
  assert.ok(r.unknown.includes('desenul'));
  assert.deepEqual(r.hens.map((x) => [x.name, x.pct]), [['Albastru', 100]]);
});

test('culorile din listă se traduc în factori doar unde e sigur', () => {
  assert.deepEqual(factorsFromColor('solzat', 'M'), { sex: 'M', base: '+', pattern: 'C', spread: false, dilute: false });
  assert.deepEqual(factorsFromColor('negru', 'F'), { sex: 'F', base: '+', pattern: null, spread: true, dilute: false });
  assert.equal(factorsFromColor('baltat', 'M').base, null, 'bălțatul ascunde culoarea de bază');
  assert.equal(factorsFromColor(null, 'M').base, null);
  // „Gut” (spus de utilizator): bază albastru-negru, desen solzat închis, dominant peste dungi.
  assert.deepEqual(factorsFromColor('gut', 'F'), { sex: 'F', base: '+', pattern: 'CT', spread: false, dilute: false });
  // „Albastru brocat” (spus de utilizator) = albastru solzat, perechea pe albastru a lui „roșu brocat”.
  assert.deepEqual(factorsFromColor('albastru-brocat', 'M'), { sex: 'M', base: '+', pattern: 'C', spread: false, dilute: false });
});

test('ce poartă ascuns, dedus din părinți: masculul roșu cu mamă albastră poartă albastru', () => {
  const son = factorsFromColor('rosu', 'M');
  const h = inferHidden(son, factorsFromColor('rosu', 'M'), factorsFromColor('albastru', 'F'));
  assert.equal(h.baseHidden, '+');
  const checkSon = factorsFromColor('solzat', 'M');
  assert.equal(inferHidden(checkSon, factorsFromColor('albastru', 'M'), factorsFromColor('solzat', 'F')).patternHidden, '+', 'tatăl cu dungi îi dă dungi');
  assert.equal(inferHidden(factorsFromColor('negru', 'M'), factorsFromColor('albastru', 'M'), factorsFromColor('negru', 'F')).spreadHidden, false, 'un părinte fără spread: e negru doar pe jumătate');
});
