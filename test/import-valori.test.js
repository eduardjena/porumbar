// Import Excel: citirea valorilor din celule (funcții pure).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readSex, readBreed, readEyeColor, readStatus, readCode, readLines, readDate, slashOrder, ringWithCountry, cut } from '../src/table-values.js';
import { __setForTest } from '../src/i18n.js';
import { parseRing } from '../src/rings.js';
import { STATUSES, COLORS } from '../src/catalog.js';

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

test('readCode: potrivește și numele japoneze (valoarea pusă de mână, independent de traduceri)', () => {
  __setForTest('ja', 'catalog.culoare.albastru', 'ブルー');
  assert.equal(readCode('ブルー', COLORS, 'catalog.culoare'), 'albastru');
});

test('readLines: separatori, curățare, cel mult 10', () => {
  assert.deepEqual(readLines('Janssen; Van Loon / Delbar'), ['Janssen', 'Van Loon', 'Delbar']);
  assert.deepEqual(readLines(' a,, b ;'), ['a', 'b']);
  assert.deepEqual(readLines('Janssen、Van Loon，Delbar'), ['Janssen', 'Van Loon', 'Delbar'], 'virgulele japoneze');
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

test('readDate: an întâi cu puncte, maghiar cu spații și punct la final', () => {
  assert.equal(readDate('2024.04.05'), '2024-04-05');
  assert.equal(readDate('2024. 04. 05.'), '2024-04-05');
  assert.equal(readDate('2024.4.5.'), '2024-04-05');
  assert.equal(readDate('2024. 02. 31.'), null);
});

test('readDate: ora de după dată se lasă deoparte', () => {
  assert.equal(readDate('05.04.2024 00:00'), '2024-04-05');
  assert.equal(readDate('05.04.2024 13:45:10'), '2024-04-05');
  assert.equal(readDate('2024-04-05T00:00'), '2024-04-05');
  assert.equal(readDate('2024-04-05T00:00:00.000Z'), '2024-04-05');
  assert.equal(readDate('2024-04-05 00:00:00'), '2024-04-05');
  assert.equal(readDate('2024. 04. 05. 0:00:00'), '2024-04-05');
  assert.equal(readDate('4/5/2024 12:00 AM', 'md'), '2024-04-05');
  assert.equal(readDate('00:00'), null);
});

test('readDate cu „/”: ziua întâi, sau luna întâi când coloana o cere', () => {
  assert.equal(readDate('05/04/2024'), '2024-04-05');
  assert.equal(readDate('05/04/2024', 'dm'), '2024-04-05');
  assert.equal(readDate('04/05/2024', 'md'), '2024-04-05');
  assert.equal(readDate('04/25/2024', 'md'), '2024-04-25');
  assert.equal(readDate('04/25/2024', 'dm'), null);
});

test('slashOrder: ordinea zilei și a lunii pe toată coloana', () => {
  assert.equal(slashOrder(['05/04/2024', '25/04/2024']), 'dm');
  assert.equal(slashOrder(['04/05/2024', '04/25/2024']), 'md');
  assert.equal(slashOrder(['04/05/2024 00:00', '04/25/2024 00:00']), 'md');
  assert.equal(slashOrder(['04/05/2024', '03/06/2024']), 'dm', 'nehotărât: ca în România');
  assert.equal(slashOrder(['25/04/2024', '04/25/2024']), 'dm', 'o zi peste 12 pe primul loc hotărăște');
  assert.equal(slashOrder(['05.04.2024', '', null, '2024-04-25']), 'dm');
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
