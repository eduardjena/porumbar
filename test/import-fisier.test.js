import { test } from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import * as XLSX from '../web/node_modules/xlsx/xlsx.mjs'; // «xlsx» trăiește în web/node_modules
import { readWorkbook, firstSheetWithData, MAX_FILE_BYTES } from '../web/src/app/shared/tabel-fisier.ts';
import { parsePasted, findHeader, buildRows } from '../web/src/app/shared/tabel-coloane.ts';

// Un registru de lucru făcut cu SheetJS, ca fișier (ArrayBuffer).
function build(sheets, bookType) {
  const wb = XLSX.utils.book_new();
  for (const [name, aoa] of sheets) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), name);
  return XLSX.write(wb, { type: 'array', bookType });
}

const FOI = [['Gol', []], ['Porumbei', [['Nume', 'Inel'], ['Mălai', 'RO-24-1'], ['Ștefan', 'RO-24-2']]]];

test('xlsx cu două foi: prima foaie cu date e a doua, celulele sunt text', () => {
  const sheets = readWorkbook(build(FOI, 'xlsx'), 'p.xlsx', parsePasted);
  assert.equal(sheets.length, 2);
  assert.equal(firstSheetWithData(sheets), 1);
  assert.deepEqual(sheets[1].rows, [['Nume', 'Inel'], ['Mălai', 'RO-24-1'], ['Ștefan', 'RO-24-2']]);
});

test('xls vechi: aceleași rânduri', () => {
  const sheets = readWorkbook(build(FOI, 'biff8'), 'p.xls', parsePasted);
  assert.equal(firstSheetWithData(sheets), 1);
  assert.deepEqual(sheets[1].rows, [['Nume', 'Inel'], ['Mălai', 'RO-24-1'], ['Ștefan', 'RO-24-2']]);
});

test('celule numerice și date', () => {
  const data = build([['F', [['Inel', 'Data'], [117345, new Date(2024, 3, 5)]]]], 'xlsx');
  const rows = readWorkbook(data, 'p.xlsx', parsePasted)[0].rows;
  assert.equal(rows[1][0], '117345');
  assert.equal(rows[1][1], '05.04.2024');
});

test('csv windows-1250: diacriticele rămân întregi', () => {
  const w1250 = { 'ă': 0xE3, 'Ş': 0xAA, 'ş': 0xBA };
  const text = 'Nume;Inel\nMălai;RO-24-1\nŞtefan;RO-24-2\n';
  const bytes = Uint8Array.from([...text].map((c) => w1250[c] ?? c.charCodeAt(0)));
  const sheets = readWorkbook(bytes.buffer, 'p.csv', parsePasted);
  const names = sheets[0].rows.slice(1).map((r) => r[0]);
  assert.deepEqual(names, ['Mălai', 'Ştefan']);
  assert.ok(!sheets[0].rows.flat().join('').includes('\uFFFD'));
});

test('fișier prea mare', () => {
  assert.throws(() => readWorkbook(new ArrayBuffer(MAX_FILE_BYTES + 1), 'p.xlsx', parsePasted), { message: 'fisier_mare' });
});

test('foaia care începe la B3, cu un rând gol la mijloc: numărul rândului e cel din Excel', () => {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([['Inel', 'Nume'], ['RO-24-1', 'A'], [], ['RO-24-2', 'B']], { origin: 'B3' });
  ws['!ref'] = 'B3:C6'; // zona folosită, cum o scrie Excel (SheetJS ar pune A1:C6)
  XLSX.utils.book_append_sheet(wb, ws, 'F');
  const rows = readWorkbook(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }), 'p.xlsx', parsePasted)[0].rows;
  assert.equal(rows[2][0], 'Inel', 'antetul stă pe rândul 3');
  assert.deepEqual(rows[3], ['RO-24-1', 'A']);
  assert.deepEqual(rows[4], ['', '']);
  assert.deepEqual(rows[5], ['RO-24-2', 'B']);
  const h = findHeader(rows);
  assert.equal(h, 2);
  assert.deepEqual(buildRows(rows, ['inel', 'nume'], h).map((r) => [r.line, r.ring]), [[4, 'RO-24-1'], [6, 'RO-24-2']]);
});

test('o zonă formatată până la capătul foii nu face un milion de rânduri', () => {
  const ws = XLSX.utils.aoa_to_sheet([['Inel'], ['RO-24-1']]);
  ws['!ref'] = 'A1:Z100000';
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'F');
  const data = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  const t0 = performance.now();
  const rows = readWorkbook(data, 'p.xlsx', parsePasted)[0].rows;
  const ms = performance.now() - t0;
  assert.deepEqual(rows, [['Inel'], ['RO-24-1']]);
  assert.ok(ms < 1500, `${Math.round(ms)} ms: zona goală nu se parcurge`);
});
