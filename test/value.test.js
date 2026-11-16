import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pigeonValue } from '../src/value.js';

test('toate trei', () =>
  assert.deepEqual(pigeonValue({ scores: { echilibru: 5, aripa: 3 }, offspringCount: 2, status: 'reproducator' }), {
    score: 64,
    band: 4,
    parts: { evaluare: 75, pui: 20, reproducator: 100 },
  }));

test('fără evaluare: ponderile se reîmpart', () =>
  assert.equal(pigeonValue({ scores: {}, offspringCount: 5, status: 'reproducator' }).score, 70));

test('doar evaluare', () => {
  const v = pigeonValue({ scores: { echilibru: 4 }, offspringCount: 0, status: 'concurent' });
  assert.equal(v.score, 38);
  assert.equal(v.band, 2);
});

test('pui peste 10 = punctaj întreg', () =>
  assert.equal(pigeonValue({ scores: {}, offspringCount: 25, status: null }).parts.pui, 100));

test('treptele', () => {
  assert.equal(pigeonValue({ scores: { echilibru: 5 }, offspringCount: 10, status: 'reproducator' }).band, 5);
  assert.equal(pigeonValue({ scores: {}, offspringCount: 2, status: null }).band, 1);
});

test('fără date (Review Focus 1)', () =>
  assert.deepEqual(pigeonValue({ scores: {}, offspringCount: 0, status: 'tanar' }), {
    score: null,
    band: 0,
    parts: { pui: 0, reproducator: 0 },
  }));

test('scores lipsă e ca fără note', () => assert.equal(pigeonValue({ offspringCount: 0, status: null }).score, null));
