// Limba fișei tipărite / PDF, așteptarea fontului la tipar și CSS-ul fonturilor din PDF (funcții fără Angular).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sheetLangs, allowedSheetLang } from '../web/src/app/core/sheet-langs.ts';
import { within, withTimeout, PDF_TIMEOUT_MS } from '../web/src/app/core/within.ts';
import { joinFontCss } from '../web/src/app/core/font-faces.ts';

const LANGS = [{ code: 'ro', public: true }, { code: 'hu', public: true }, { code: 'ja', public: false }];

test('limbile fișei: cele publice și limba contului', () => {
  assert.deepEqual(sheetLangs(LANGS, 'ro').map((l) => l.code), ['ro', 'hu']);
  assert.deepEqual(sheetLangs(LANGS, 'ja').map((l) => l.code), ['ro', 'hu', 'ja']);
  assert.deepEqual(sheetLangs(LANGS, undefined).map((l) => l.code), ['ro', 'hu']);
});

test('limba aleasă pentru fișă nu rămâne la un cont care nu o are (a trecut în română / a intrat altcineva)', () => {
  assert.equal(allowedSheetLang('ja', LANGS, 'ja', 'ro'), 'ja');
  assert.equal(allowedSheetLang('ja', LANGS, 'ro', 'ro'), 'ro');
  assert.equal(allowedSheetLang('ja', LANGS, 'hu', 'hu'), 'hu');
  assert.equal(allowedSheetLang('hu', LANGS, 'ro', 'ro'), 'hu');
  assert.equal(allowedSheetLang(null, LANGS, 'ja', 'ja'), 'ja');
});

test('within: nu așteaptă mai mult decât trebuie și nu pică', { timeout: 5000 }, async () => {
  await within(new Promise(() => {}), 20);
  await within(Promise.reject(new Error('fără rețea')), 4000);
  const t0 = Date.now();
  await within(Promise.resolve(), 4000);
  assert.ok(Date.now() - t0 < 1000);
});

test('joinFontCss: nimic adus înseamnă undefined (fonturile implicite), nu un CSS gol', () => {
  assert.equal(joinFontCss(['', '']), undefined);
  assert.equal(joinFontCss([]), undefined);
  assert.equal(joinFontCss(['', '@font-face{a}']), '@font-face{a}');
});

test('withTimeout: rezultatul trece, eroarea trece, o lucrare blocată pică cu mesajul dat după limită', { timeout: 5000 }, async () => {
  assert.equal(PDF_TIMEOUT_MS, 30_000);
  assert.equal(await withTimeout(Promise.resolve(7), 1000, () => new Error('x')), 7);
  await assert.rejects(withTimeout(Promise.reject(new Error('real')), 1000, () => new Error('x')), /real/);
  const t0 = Date.now();
  await assert.rejects(withTimeout(new Promise(() => {}), 30, () => new Error('prea lent')), /prea lent/);
  assert.ok(Date.now() - t0 < 1000);
});
