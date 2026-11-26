// Excel japonez: titluri, date (și ere), sex, culori fără literă singură, separatori late. Pur, fără Postgres.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readDate, readSex, readLines } from '../src/table-values.js';
import { matchColor } from '../src/catalog.js';
import { findHeader, guessColumns } from '../web/src/app/shared/tabel-coloane.ts';

test('date: formele japoneze, cele de azi neschimbate', () => {
  assert.equal(readDate('2025/11/25'), '2025-11-25');
  assert.equal(readDate('2025/1/5'), '2025-01-05');
  assert.equal(readDate('25/11/2025'), '2025-11-25');
  assert.equal(readDate('2025年11月25日'), '2025-11-25');
  assert.equal(readDate('２０２５年１１月２５日'), '2025-11-25');
  assert.equal(readDate('令和7年11月25日'), '2025-11-25');
  assert.equal(readDate('令和元年5月1日'), '2019-05-01');
  assert.equal(readDate('平成30年5月1日'), '2018-05-01');
  assert.equal(readDate('昭和60年1月1日'), '1985-01-01');
  assert.equal(readDate('R7.11.25'), '2025-11-25');
  assert.equal(readDate('H30.5.1'), '2018-05-01');
  assert.equal(readDate('S60.1.1'), '1985-01-01');
  assert.equal(readDate('2025/2/30'), null);
  assert.equal(readDate('2025年11月'), null);
  assert.equal(readDate('05.04.2024'), '2024-04-05');
  assert.equal(readDate('2024-04-05'), '2024-04-05');
});

test('sex: cuvinte japoneze', () => {
  for (const [w, s] of [['オス', 'M'], ['メス', 'F'], ['雄', 'M'], ['雌', 'F'], ['♂', 'M'], ['♀', 'F'], ['ｵｽ', 'M']]) assert.equal(readSex(w), s, w);
});

test('culori: litera singură nu se mai potrivește la ja; ro/hu ca azi', () => {
  assert.deepEqual(matchColor('B'), { code: 'baltat', pa: false, rest: '' });
  assert.equal(matchColor('B', { lang: 'ja' }).code, null);
  assert.equal(matchColor('B', { lang: 'ro' }).code, 'baltat');
  assert.equal(matchColor('ブルー', { lang: 'ja' }).code, 'albastru');
});

test('titluri japoneze', () => {
  const antet = ['脚環番号', '性別', '羽色', '父', '母', '生年月日', '作出者', '鳩名'];
  assert.equal(findHeader([antet]), 0);
  assert.deepEqual(guessColumns([antet, ['25-AB-01234', 'オス', 'ブルー', '', '', '2025/11/25', '山田', 'テスト']], 0),
    ['inel', 'sex', 'culoare', 'tata', 'mama', 'eclozare', 'crescator', 'nume']);
  for (const [t, f] of [['足環', 'inel'], ['足輪', 'inel'], ['リング', 'inel'], ['リング番号', 'inel'], ['雌雄', 'sex'], ['色', 'culoare'],
    ['父鳩', 'tata'], ['母鳩', 'mama'], ['孵化日', 'eclozare'], ['生年', 'eclozare'], ['名前', 'nume'], ['国', 'inel_tara']]) {
    assert.equal(guessColumns([[t, 'x'], ['a', 'b']], 0)[0], f, t);
  }
});

test('separatori late în liste', () => {
  assert.deepEqual(readLines('A；B／C、D'), ['A', 'B', 'C', 'D']);
});
