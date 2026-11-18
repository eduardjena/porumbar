import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readerModel, costOf } from '../src/pedigree-reader.js';

// Modelul pentru citirea din poze și prețul lui se pot schimba din variabilele serverului (Railway), fără cod.
const KEYS = ['PEDIGREE_MODEL', 'PEDIGREE_PRICE_INPUT', 'PEDIGREE_PRICE_OUTPUT'];
const saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

test('fără variabile: modelul și prețul de azi', () => {
  for (const k of KEYS) delete process.env[k];
  assert.equal(readerModel(), 'claude-opus-5-5');
  // 4 $ / milion de jetoane intrare, 20 $ / milion ieșire → 10.000 + 5.000 jetoane = 0,04 + 0,10 $
  assert.equal(costOf({ input_tokens: 10_000, output_tokens: 5_000 }), 140_000);
});

test('cu variabile: alt model și prețul lui (dolari pe milion de jetoane)', () => {
  process.env.PEDIGREE_MODEL = 'claude-sonnet-5-5';
  process.env.PEDIGREE_PRICE_INPUT = '3';
  process.env.PEDIGREE_PRICE_OUTPUT = '15';
  assert.equal(readerModel(), 'claude-sonnet-5-5');
  assert.equal(costOf({ input_tokens: 1_000_000, output_tokens: 1_000_000 }), 18_000_000);
});

test('valori greșite în variabile: rămân cele de azi', () => {
  process.env.PEDIGREE_MODEL = '   ';
  process.env.PEDIGREE_PRICE_INPUT = 'abc';
  process.env.PEDIGREE_PRICE_OUTPUT = '-5';
  assert.equal(readerModel(), 'claude-opus-5-5');
  assert.equal(costOf({ input_tokens: 10_000, output_tokens: 5_000 }), 140_000);
});
