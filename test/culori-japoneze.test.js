// matchColor: numele japoneze ale culorilor, așa cum le arată programul (i18n/ja.json), fără ca altceva citit azi să se
// schimbe (fixtures/culori-citite.json: ce dădea citirea înainte de numele japoneze).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { COLORS, matchColor } from '../src/catalog.js';
import { t } from '../src/i18n.js';

const ROOT = path.join(import.meta.dirname, '..');
const name = (code) => t('ja', `catalog.culoare.${code}`);

test('tot ce se citea înainte (nume, sinonime, coduri goale, cu p.a., în text) se citește exact la fel', () => {
  const before = JSON.parse(fs.readFileSync(path.join(ROOT, 'test', 'fixtures', 'culori-citite.json'), 'utf8'));
  assert.ok(Object.keys(before).length > 400);
  for (const [text, was] of Object.entries(before)) assert.deepEqual(matchColor(text), was, text);
  // Codurile goale: B = bălțat, S = solzat, G = gut, oricum ar fi numele japonez cu același cod în paranteză.
  assert.deepEqual(['B', 'S', 'G', 'R', 'A'].map((c) => matchColor(c).code), ['baltat', 'solzat', 'gut', 'rosu', 'albastru']);
});

test('fiecare culoare din ja.json se recunoaște: întreagă, cu paranteze ASCII, fără paranteză', () => {
  for (const { code } of COLORS) {
    const full = name(code);
    const ascii = full.replace('（', '(').replace('）', ')');
    const bare = full.replace(/（.*）$/, '');
    for (const s of [full, ascii, ascii.replace('(', ' ('), bare, ` ${full} `]) {
      assert.deepEqual(matchColor(s), { code, pa: false, rest: '' }, s);
    }
  }
});

test('penele albe japoneze dau „pa”, cu semnul și spațiul oricum', () => {
  for (const wing of [t('ja', 'fisa.pene_albe'), t('ja', 'form.dif_pene_albe'), '白い風切羽', '白風切羽', 'p.a.', 'WF']) {
    for (const s of [`ブルーチェック ${wing}`, `ブルーチェック（BC） ${wing}`, `ブルーチェック　${wing}`, `ブルーチェック、${wing}`]) {
      assert.deepEqual(matchColor(s), { code: 'solzat', pa: true, rest: '' }, s);
    }
  }
  assert.deepEqual(matchColor('ブルーチェック白い風切羽'), { code: 'solzat', pa: true, rest: '' });
  // Exemplul arătat de program în căsuța de culoare.
  const example = t('ja', 'hartie.ph_culoare').match(/例：(.+)）/)[1];
  assert.deepEqual(matchColor(example), { code: 'solzat', pa: true, rest: '' });
  assert.deepEqual(matchColor('BC 白い風切羽'), { code: 'solzat', pa: true, rest: '' });
  // O singură literă lângă text japonez nu se ghicește (nici înainte nu se citea): la noi B = bălțat, la ei B = albastru.
  for (const c of ['B', 'S', 'G']) assert.equal(matchColor(`${c} 白い風切羽`).code, null, c);
});

test('numele lung bate numele scurt; un cuvânt necunoscut rămâne necunoscut', () => {
  assert.equal(matchColor('レッドチェック').code, 'rosu-brocat');
  assert.equal(matchColor('レッド').code, 'rosu');
  assert.equal(matchColor('ブルー チェック').code, 'solzat');
  assert.equal(matchColor('ブルー・チェック').code, 'solzat');
  assert.equal(matchColor('ﾌﾞﾙｰﾁｪｯｸ').code, 'solzat', 'katakana îngustă');
  assert.equal(matchColor('ブルーチェック（ＢＣ）').code, 'solzat', 'cod scris lat');
  assert.deepEqual([matchColor('ブルー系').code, matchColor('フルー').code], [null, null]);
  assert.equal(matchColor('ブルーチェック 近親').rest, '近親', 'restul rămâne');
  assert.equal(matchColor('BC ブルー').code, 'solzat', 'un cod citit și înainte hotărăște și acum');
});
