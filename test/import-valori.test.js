// Import Excel: citirea valorilor din celule (funcții pure).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readSex, readBreed, readEyeColor, readStatus, readCode, readLines, readDate, ringWithCountry, cut } from '../src/table-values.js';
import { parseRing } from '../src/rings.js';
import { STATUSES } from '../src/catalog.js';

test('readSex: cuvinte românești, maghiare și internaționale', () => {
  assert.equal(readSex('Mascul'), 'M');
  assert.equal(readSex('tojó'), 'F');
  assert.equal(readSex('duivin'), 'F');
  assert.equal(readSex('♂'), 'M');
  assert.equal(readSex('Täubin'), 'F');
  assert.equal(readSex('mâle'), 'M');
  assert.equal(readSex('femelă'), 'F');
  assert.equal(readSex('H'), 'M');
  assert.equal(readSex('x'), null);
  assert.equal(readSex(''), null);
});

test('readBreed: gol → voiajor, necunoscută → alta', () => {
  assert.equal(readBreed(''), 'voiajor');
  assert.equal(readBreed('Voiajor'), 'voiajor');
  assert.equal(readBreed('ceva ciudat'), 'alta');
  assert.equal(readBreed('Postagalamb'), 'voiajor');
});

test('readCode: stare și ochi după cod sau nume', () => {
  assert.equal(readStatus('vândut'), 'vandut');
  assert.equal(readStatus('MORT'), 'mort');
  assert.equal(readStatus('nimic'), null);
  assert.equal(readCode('vandut', STATUSES, 'catalog.stare'), 'vandut');
  assert.equal(readEyeColor('Portocaliu'), 'portocaliu');
  assert.equal(readEyeColor('Narancs'), 'portocaliu');
});

test('readLines: separatori, curățare, cel mult 10', () => {
  assert.deepEqual(readLines('Janssen; Van Loon / Delbar'), ['Janssen', 'Van Loon', 'Delbar']);
  assert.deepEqual(readLines(' a,, b ;'), ['a', 'b']);
  assert.equal(readLines(Array.from({ length: 12 }, (_, i) => `L${i}`).join(',')).length, 10);
});

test('readDate: formate acceptate și respinse', () => {
  assert.equal(readDate('05.04.2024'), '2024-04-05');
  assert.equal(readDate('5.4.2024'), '2024-04-05');
  assert.equal(readDate('05/04/2024'), '2024-04-05');
  assert.equal(readDate('2024-04-05'), '2024-04-05');
  assert.equal(readDate('2024'), null);
  assert.equal(readDate('31.02.2024'), null);
});

test('ringWithCountry: pune țara coloanei doar când ajută', () => {
  const p = parseRing(ringWithCountry('24-0117345', 'RO'));
  assert.equal(p.ok, true);
  assert.equal(p.country, 'RO');
  assert.equal(p.year, 2024);
  assert.equal(p.number, '117345');
  assert.equal(ringWithCountry('BE 19 6080187', 'RO'), 'BE 19 6080187');
  assert.equal(ringWithCountry('HU-24-12345', 'HU'), 'HU-24-12345');
  assert.equal(ringWithCountry('24-0117345', null), '24-0117345');
});

test('cut: curăță și taie', () => {
  assert.equal(cut('  ', 5), null);
  assert.equal(cut(null, 5), null);
  assert.equal(cut(' abcdefg ', 3), 'abc');
});
