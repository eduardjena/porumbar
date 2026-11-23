import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePasted, looksLikeHeader, guessColumns, looksLikeRing, canContinue, buildRows } from '../web/src/app/shared/tabel-coloane.ts';

test('lipit din Excel (tab)', () => {
  assert.deepEqual(parsePasted('Inel\tNume\nRO-24-0117345\tFulger\n'), [['Inel', 'Nume'], ['RO-24-0117345', 'Fulger']]);
});

test('csv cu ; și ghilimele', () => {
  assert.deepEqual(parsePasted('a;"b;c";"d ""e"""'), [['a', 'b;c', 'd "e"']]);
});

test('rânduri goale la coadă dispar, rândurile se completează la cel mai lat', () => {
  assert.deepEqual(parsePasted('a\tb\tc\r\nd\r\n\r\n\t\t\r\n'), [['a', 'b', 'c'], ['d', '', '']]);
});

test('virgula câștigă doar când e mai consecventă; tab-ul câștigă egalitatea', () => {
  assert.deepEqual(parsePasted('a,b\nc,d'), [['a', 'b'], ['c', 'd']]);
  assert.deepEqual(parsePasted('a\tb;c\nd\te;f'), [['a', 'b;c'], ['d', 'e;f']]);
});

test('titluri în olandeză', () => {
  const rows = [['Ringnummer', 'Naam', 'Geslacht', 'Kleur', 'Vader', 'Moeder'], ['BE-19-6080187', 'x', 'M', 'blauw', '', '']];
  assert.equal(looksLikeHeader(rows), true);
  assert.deepEqual(guessColumns(rows, true), ['inel', 'nume', 'sex', 'culoare', 'tata', 'mama']);
});

test('titluri în maghiară', () => {
  const rows = [['Gyűrűszám', 'Név', 'Ivar', 'Szín', 'Apa', 'Anya']];
  assert.deepEqual(guessColumns(rows, true), ['inel', 'nume', 'sex', 'culoare', 'tata', 'mama']);
});

test('titluri românești, cu diacritice, și un câmp o singură dată', () => {
  const rows = [['Nr. inel', 'Tată', 'Mamă', 'Data eclozării', 'Observații', 'Ring']];
  assert.deepEqual(guessColumns(rows, true), ['inel', 'tata', 'mama', 'eclozare', 'observatii', 'ignor']);
});

test('fără titlu, după conținut', () => {
  const rows = [
    ['RO-24-0117345', 'M', 'BE-19-6080187', 'NL-20-1234567'],
    ['RO-24-0117346', 'F', 'BE-19-6080188', 'NL-20-1234568'],
    ['RO-24-0117347', 'M', 'BE-19-6080189', 'NL-20-1234569'],
    ['RO-24-0117348', 'F', 'BE-19-6080190', 'NL-20-1234570'],
    ['RO-24-0117349', 'M', 'BE-19-6080191', 'NL-20-1234571'],
  ];
  assert.equal(looksLikeHeader(rows), false);
  assert.deepEqual(guessColumns(rows, false), ['inel', 'sex', 'tata', 'mama']);
});

test('datele nu sunt luate drept inele', () => {
  const rows = [['RO-24-0117345', '12.05.2024'], ['RO-24-0117346', '2024-05-13'], ['RO-24-0117347', '13/05/2024']];
  assert.equal(looksLikeRing('2024-05-13'), false);
  assert.deepEqual(guessColumns(rows, false), ['inel', 'eclozare']);
});

test('looksLikeRing: formă ieftină', () => {
  assert.equal(looksLikeRing('RO-24-0117345'), true);
  assert.equal(looksLikeRing('HU 24 0123/12345'), true);
  assert.equal(looksLikeRing('Fulger 12'), false);
  assert.equal(looksLikeRing('abc#12345'), false);
});

test('inelul în bucăți', () => {
  const fields = ['inel_tara', 'inel_an', 'inel_numar'];
  assert.equal(buildRows([['RO', '24', '0117345']], fields, false)[0].ring, 'RO-24-0117345');
  assert.equal(buildRows([['', '24', '0117345']], fields, false)[0].ring, '24-0117345');
});

test('numărul rândului: titlul se numără', () => {
  const rows = [['Inel', 'Nume'], ['RO-24-0117345', 'A'], ['RO-24-0117346', 'B']];
  const out = buildRows(rows, ['inel', 'nume'], true);
  assert.equal(out[1].line, 3);
  assert.equal(out[1].name, 'B');
});

test('rândurile goale se sar, câmpurile mapate trec, restul nu', () => {
  const rows = [['RO-24-1', 'M', 'x'], ['', ' ', 'y'], ['RO-24-2', '', '']];
  const out = buildRows(rows, ['inel', 'sex', 'ignor'], false);
  assert.deepEqual(out, [{ line: 1, ring: 'RO-24-1', sex: 'M' }, { line: 3, ring: 'RO-24-2' }]);
});

test('canContinue', () => {
  assert.equal(canContinue(['nume', 'sex']), false);
  assert.equal(canContinue(['inel_numar']), true);
  assert.equal(canContinue(['ignor', 'inel']), true);
});

test('„Nr.” singur e contor de rânduri, nu număr de inel', () => {
  const rows = [['Nr.', 'Nume', 'Sex'], ['1', 'Fulger', 'M']];
  const f = guessColumns(rows, true);
  assert.equal(f.includes('inel'), false);
  assert.equal(f.includes('inel_numar'), false);
  assert.equal(canContinue(f), false);
});

test('„Nr. crt.” e ignorat, inelul rămâne la „Inel”', () => {
  assert.deepEqual(guessColumns([['Nr. crt.', 'Inel', 'Nume'], ['1', 'RO-24-0117345', 'A']], true), ['ignor', 'inel', 'nume']);
});

test('inelul în bucăți după titlu: Țara, An, Nr', () => {
  assert.deepEqual(guessColumns([['Țara', 'An', 'Nr'], ['RO', '24', '0117345']], true), ['inel_tara', 'inel_an', 'inel_numar']);
});

test('„Nr.” lângă „Inel” și „An”: contorul rămâne ignorat, inelul vine din „Inel”', () => {
  const rows = [['Nr.', 'Inel', 'An'], ['1', 'RO-24-0117345', '24']];
  const f = guessColumns(rows, true);
  assert.equal(f[0], 'ignor');
  assert.equal(buildRows(rows, f, true)[0].ring, 'RO-24-0117345');
});
