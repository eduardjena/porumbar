import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePasted, findHeader, guessColumns, looksLikeRing, canContinue, buildRows, ringCountries, defaultRingCountry } from '../web/src/app/shared/tabel-coloane.ts';

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
  assert.equal(findHeader(rows), 0);
  assert.deepEqual(guessColumns(rows, 0), ['inel', 'nume', 'sex', 'culoare', 'tata', 'mama']);
});

test('titluri în maghiară', () => {
  const rows = [['Gyűrűszám', 'Név', 'Ivar', 'Szín', 'Apa', 'Anya']];
  assert.deepEqual(guessColumns(rows, 0), ['inel', 'nume', 'sex', 'culoare', 'tata', 'mama']);
});

test('titluri românești, cu diacritice, și un câmp o singură dată', () => {
  const rows = [['Nr. inel', 'Tată', 'Mamă', 'Data eclozării', 'Observații', 'Ring']];
  assert.deepEqual(guessColumns(rows, 0), ['inel', 'tata', 'mama', 'eclozare', 'observatii', 'ignor']);
});

test('fără titlu, după conținut', () => {
  const rows = [
    ['RO-24-0117345', 'M', 'BE-19-6080187', 'NL-20-1234567'],
    ['RO-24-0117346', 'F', 'BE-19-6080188', 'NL-20-1234568'],
    ['RO-24-0117347', 'M', 'BE-19-6080189', 'NL-20-1234569'],
    ['RO-24-0117348', 'F', 'BE-19-6080190', 'NL-20-1234570'],
    ['RO-24-0117349', 'M', 'BE-19-6080191', 'NL-20-1234571'],
  ];
  assert.equal(findHeader(rows), -1);
  assert.deepEqual(guessColumns(rows, -1), ['inel', 'sex', 'tata', 'mama']);
});

test('datele nu sunt luate drept inele', () => {
  const rows = [['RO-24-0117345', '12.05.2024'], ['RO-24-0117346', '2024-05-13'], ['RO-24-0117347', '13/05/2024']];
  assert.equal(looksLikeRing('2024-05-13'), false);
  assert.equal(looksLikeRing('2024. 05. 13.'), false, 'data maghiară');
  assert.equal(looksLikeRing('2024. 05. 13. 0:00:00'), false);
  assert.deepEqual(guessColumns(rows, -1), ['inel', 'eclozare']);
});

test('looksLikeRing: formă ieftină', () => {
  assert.equal(looksLikeRing('RO-24-0117345'), true);
  assert.equal(looksLikeRing('HU 24 0123/12345'), true);
  assert.equal(looksLikeRing('Fulger 12'), false);
  assert.equal(looksLikeRing('abc#12345'), false);
});

test('inelul în bucăți', () => {
  const fields = ['inel_tara', 'inel_an', 'inel_numar'];
  assert.equal(buildRows([['RO', '24', '0117345']], fields, -1)[0].ring, 'RO-24-0117345');
  assert.equal(buildRows([['', '24', '0117345']], fields, -1)[0].ring, '24-0117345');
});

test('numărul rândului: titlul se numără', () => {
  const rows = [['Inel', 'Nume'], ['RO-24-0117345', 'A'], ['RO-24-0117346', 'B']];
  const out = buildRows(rows, ['inel', 'nume'], 0);
  assert.equal(out[1].line, 3);
  assert.equal(out[1].name, 'B');
});

test('rândurile goale se sar, câmpurile mapate trec, restul nu', () => {
  const rows = [['RO-24-1', 'M', 'x'], ['', ' ', 'y'], ['RO-24-2', '', '']];
  const out = buildRows(rows, ['inel', 'sex', 'ignor'], -1);
  assert.deepEqual(out, [{ line: 1, ring: 'RO-24-1', sex: 'M' }, { line: 3, ring: 'RO-24-2' }]);
});

test('canContinue', () => {
  assert.equal(canContinue(['nume', 'sex']), false);
  assert.equal(canContinue(['inel_numar']), true);
  assert.equal(canContinue(['ignor', 'inel']), true);
});

test('„Nr.” singur e contor de rânduri, nu număr de inel', () => {
  const rows = [['Nr.', 'Nume', 'Sex'], ['1', 'Fulger', 'M']];
  const f = guessColumns(rows, 0);
  assert.equal(f.includes('inel'), false);
  assert.equal(f.includes('inel_numar'), false);
  assert.equal(canContinue(f), false);
});

test('„Nr. crt.” e ignorat, inelul rămâne la „Inel”', () => {
  assert.deepEqual(guessColumns([['Nr. crt.', 'Inel', 'Nume'], ['1', 'RO-24-0117345', 'A']], 0), ['ignor', 'inel', 'nume']);
});

test('inelul în bucăți după titlu: Țara, An, Nr', () => {
  assert.deepEqual(guessColumns([['Țara', 'An', 'Nr'], ['RO', '24', '0117345']], 0), ['inel_tara', 'inel_an', 'inel_numar']);
});

test('„Nr.” lângă „Inel” și „An”: contorul rămâne ignorat, inelul vine din „Inel”', () => {
  const rows = [['Nr.', 'Inel', 'An'], ['1', 'RO-24-0117345', '24']];
  const f = guessColumns(rows, 0);
  assert.equal(f[0], 'ignor');
  assert.equal(buildRows(rows, f, 0)[0].ring, 'RO-24-0117345');
});

test('titlul tabelului deasupra antetului: antetul e găsit în primele 5 rânduri', () => {
  const rows = [
    ['Porumbarul meu 2024', '', ''],
    ['', '', ''],
    ['Inel', 'Nume', 'Sex'],
    ['RO-24-0117345', 'Fulger', 'M'],
    ['RO-24-0117346', 'Vânt', 'F'],
  ];
  assert.equal(findHeader(rows), 2);
  const f = guessColumns(rows, 2);
  assert.deepEqual(f, ['inel', 'nume', 'sex']);
  const out = buildRows(rows, f, 2);
  assert.deepEqual(out.map((r) => [r.line, r.ring]), [[4, 'RO-24-0117345'], [5, 'RO-24-0117346']], 'titlul nu pleacă, rândurile au numărul din Excel');
});

test('antetul: cel puțin 2 titluri și niciun inel; mai jos de 5 rânduri nu se caută', () => {
  assert.equal(findHeader([['Porumbei', 'Inel'], ['Inel', 'Nume'], ['RO-24-0117345', 'A']]), 1, 'un singur cuvânt de titlu nu ajunge când urmează un antet adevărat');
  assert.equal(findHeader([['Inel', 'RO-24-0117345'], ['RO-24-0117346', 'A']]), -1, 'rândul cu inel nu e antet');
  assert.equal(findHeader([['Inel'], ['RO-24-0117345']]), 0, 'primul rând cu un singur titlu rămâne antet');
  const deep = [['a'], ['b'], ['c'], ['d'], ['e'], ['Inel', 'Nume'], ['RO-24-0117345', 'A']];
  assert.equal(findHeader(deep), -1);
  const blanks = [[''], ['Titlu'], [''], [''], ['Inel', 'Nume'], ['RO-24-0117345', 'A']];
  assert.equal(findHeader(blanks), 4, 'rândurile goale nu se numără între cele 5');
});

test('rândurile de secțiune pleacă la server cu numărul lor (serverul le sare și le arată)', () => {
  const rows = [['Inel', 'Sex'], ['MASCULI', ''], ['RO-24-0117345', 'M'], ['FEMELE', ''], ['RO-24-0117346', 'F']];
  const out = buildRows(rows, guessColumns(rows, findHeader(rows)), findHeader(rows));
  assert.deepEqual(out.map((r) => [r.line, r.ring]), [[2, 'MASCULI'], [3, 'RO-24-0117345'], [4, 'FEMELE'], [5, 'RO-24-0117346']]);
});

test('inelul maghiar în bucăți: anul întreg devine două cifre', () => {
  const fields = ['inel_tara', 'inel_an', 'inel_club', 'inel_numar'];
  assert.equal(buildRows([['HU', '2024', '0123', '12345']], fields, -1)[0].ring, 'HU-24-0123-12345');
  assert.equal(buildRows([['RO', '2024', '', '0117345']], fields, -1)[0].ring, 'RO-24-0117345');
  assert.equal(buildRows([['RO', '24', '', '0117345']], fields, -1)[0].ring, 'RO-24-0117345');
});

test('țara inelelor fără țară: japonezii au JP, primul și implicit; româna și maghiara rămân ca înainte', () => {
  const before = ['RO', 'HU', 'DE', 'NL', 'BE', 'PL', 'CZ', 'SK', 'RS', 'BG', 'MD', 'UA', 'IT', 'FR', 'GB', 'US', 'AT', 'SI', 'HR'];
  assert.deepEqual(ringCountries('ro'), before);
  assert.deepEqual(ringCountries('hu'), before);
  assert.deepEqual(ringCountries(undefined), before);
  assert.deepEqual(ringCountries('ja'), ['JP', ...before]);
  assert.deepEqual(['ro', 'hu', 'ja', undefined].map(defaultRingCountry), ['RO', 'HU', 'JP', 'RO']);
  for (const lang of ['ro', 'hu', 'ja']) assert.ok(ringCountries(lang).includes(defaultRingCountry(lang)), lang);
});
