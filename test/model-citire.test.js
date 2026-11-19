import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readerModel, costOf, requestFor } from '../src/pedigree-reader.js';

// Citirea: Sonnet 5.5 (testul real din 2026-11-19: singurul sigur la fiecare citire). Se poate schimba din variabilele
// serverului (Railway), fără cod. Prețurile: din documentația Anthropic (dolari pe milion de jetoane).
const KEYS = ['PEDIGREE_MODEL', 'PEDIGREE_PRICE_INPUT', 'PEDIGREE_PRICE_OUTPUT'];
const saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});
const M = 1_000_000;

test('fără variabile: citirea merge pe Sonnet 5.5', () => {
  for (const k of KEYS) delete process.env[k];
  assert.equal(readerModel(), 'claude-sonnet-5-5');
});

test('prețul fiecărui model (dolari pe milion de jetoane → microdolari)', () => {
  for (const k of KEYS) delete process.env[k];
  const usage = { input_tokens: M, output_tokens: M };
  assert.equal(costOf(usage, 'claude-haiku-5-5'), 600_000); // 0,10 $ + 0,50 $
  assert.equal(costOf(usage, 'claude-sonnet-5-5'), 12_000_000); // 2 $ + 10 $
  assert.equal(costOf(usage, 'claude-opus-5-5'), 24_000_000); // 4 $ + 20 $
  assert.equal(costOf(usage, 'model-necunoscut'), 24_000_000, 'un model necunoscut se socotește la prețul cel mai mare');
});

test('cu variabile: alt model principal și prețul lui', () => {
  process.env.PEDIGREE_MODEL = 'claude-haiku-5-5';
  process.env.PEDIGREE_PRICE_INPUT = '3';
  process.env.PEDIGREE_PRICE_OUTPUT = '15';
  assert.equal(readerModel(), 'claude-haiku-5-5');
  assert.equal(costOf({ input_tokens: M, output_tokens: M }, readerModel()), 18_000_000);
  process.env.PEDIGREE_MODEL = '   ';
  process.env.PEDIGREE_PRICE_INPUT = 'abc';
  assert.equal(readerModel(), 'claude-sonnet-5-5', 'valoare goală: modelul implicit');
});

test('cererea către fiecare model: Sonnet și Opus cu efort mic, Haiku (dacă e ales) gândește, cu efort mediu', () => {
  // Testul real din 2026-11-19: fără gândire, Haiku punea inelele în căsuțe greșite și se oprea la jumătate (1–4 din 31);
  // cu gândire adaptivă și efort mediu citea de obicei bine, dar cam o dată din 6 tot greșea.
  assert.deepEqual(requestFor('claude-haiku-5-5'), { thinking: { type: 'adaptive' }, output_config_effort: 'medium', fallback: false });
  assert.deepEqual(requestFor('claude-sonnet-5-5'), { thinking: { type: 'between_tools' }, output_config_effort: 'low', fallback: false });
  // La Opus 5.5 gândirea nu se poate opri: doar efortul mic.
  assert.deepEqual(requestFor('claude-opus-5-5'), { thinking: null, output_config_effort: 'low', fallback: true });
});
