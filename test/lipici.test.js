// Semnele lipite între bucăți traduse („.”, „, ”, „ (”, „„…””, „ – ”, spațiul): în ro/hu rămân cum sunt scrise, în japoneză
// devin 。、（）「」〜 și fără spații. Harta stă în i18n/languages.json („semne”); o citesc și interfața, și serverul.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { glueWith } from '../web/src/app/core/glue.ts';
import { LANGS, glue } from '../src/i18n.js';
import { journalText } from '../src/treatments.js';
import { groupNestItems } from '../src/nest-reminders.js';

const ROOT = path.join(import.meta.dirname, '..');
const semne = (code) => LANGS.find((l) => l.code === code).semne;
const BUCATI = ['.', '. ', ', ', ' (', ')', ').', ': ', '„', ' „', '”', ' – ', ' ', '\u00a0', ' %', '80–100'];

test('lipici: ro și hu rămân caracter cu caracter', () => {
  for (const code of ['ro', 'hu']) {
    assert.equal(semne(code), undefined);
    for (const s of BUCATI) {
      assert.equal(glueWith(semne(code), s), s);
      assert.equal(glue(code, s), s);
    }
  }
});

test('lipici: japoneza are semnele ei, fără spații; interfața și serverul la fel', () => {
  const ja = ['。', '。', '、', '（', '）', '）。', '：', '「', '「', '」', '〜', '', '', '%', '80〜100'];
  assert.deepEqual(BUCATI.map((s) => glueWith(semne('ja'), s)), ja);
  assert.deepEqual(BUCATI.map((s) => glue('ja', s)), ja);
});

test('lipici: „ · ”, „ × ”, cifrele și semnele fără pereche nu se schimbă', () => {
  for (const s of ['12', '12%', '×', '·', '/', '→']) assert.equal(glueWith(semne('ja'), s), s);
});

test('lipici pe server: perioada din jurnal și cuiburile din amintiri', () => {
  const tr = { name: 'Vitamine X', method: 'apa', start_date: '2026-11-21', days: 5, note: null, cancelled_on: null };
  assert.match(journalText(tr, 'ro'), /21\.11\.2026 – 25\.11\.2026\)$/);
  assert.match(journalText(tr, 'hu'), /2026\. 11\. 21\. – 2026\. 11\. 25\.\)$/);
  assert.match(journalText(tr, 'ja'), /、2026\/11\/21〜2026\/11\/25）$/);
  const items = [{ kind: 'mirare', nest: '3', label: null }, { kind: 'mirare', nest: '5', label: null }, { kind: 'mirare', nest: null, label: 'A × B' }];
  assert.equal(groupNestItems(items, 'ro')[0].text, 'Mâine e mirarea ouălor: cuibul 3, 5, A × B');
  assert.equal(groupNestItems(items, 'hu')[0].text, 'Holnap van a tojások átvilágítása: 3, 5. fészek, A × B');
  assert.equal(groupNestItems(items, 'ja')[0].text, '明日は検卵の日です：巣3、5、A × B');
});

test('lipici: paranteza deschisă în dicționar se închide cu perechea ei', () => {
  const ja = JSON.parse(fs.readFileSync(path.join(ROOT, 'i18n', 'ja.json'), 'utf8'));
  assert.equal(ja['form.coi_stramosi'], '（共通の祖先：');
  assert.equal(ja['arbore.stramosi_comuni'], '、共通の祖先：');
});

/*
 * Paza: niciun semn lipit de mână pe ecrane. Consola vânzătorului rămâne în română; câmpul „Linii” se scrie cu virgulă
 * (așa îl citește programul), deci nu e text de ecran.
 */
const IN_SABLON = /\}\}[.,:;)”]|<\/\w+>[.,:;)]|[(„]\{\{|\{, \{\{/;
const IN_COD = /[„”]\$\{|\}”|'„'(?! ?\||\))|' \('(?! ?\||\))|'\)'(?! ?\||\))|join\('(?:, | – )'\)|\} – \$\{|\} %|\}: \$\{/;
const CAMPUL_LINII = ["lines: p.lines.join(', ')", "lines(f.mother)])].join(', ')"];
test('lipici: semnele de pe ecrane trec prin `glue`', () => {
  const dir = path.join(ROOT, 'web', 'src', 'app');
  const found = [];
  for (const f of fs.readdirSync(dir, { recursive: true })) {
    if (!f.endsWith('.ts') || f.startsWith(path.join('pages', 'admin'))) continue;
    const src = fs.readFileSync(path.join(dir, f), 'utf8').replace(/\/\*[\s\S]*?\*\/|<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, ''));
    src.split('\n').forEach((line, i) => {
      const code = line.replace(/(^|\s)\/\/.*$/, '');
      if (CAMPUL_LINII.some((x) => code.includes(x)) || code.includes('rotate(')) return; // rotate: SVG, nu text
      if ((code.includes('{{') && IN_SABLON.test(code)) || IN_COD.test(code)) found.push(`${f}:${i + 1}: ${code.trim().slice(0, 140)}`);
    });
  }
  assert.deepEqual(found, [], `De trecut prin glue:\n${found.join('\n')}`);
});
