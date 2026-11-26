// Semnele lipite între bucăți traduse („.”, „, ”, „ (”, „„…””, „ – ”, spațiul): în ro/hu rămân cum sunt scrise, în japoneză
// devin 。、（）「」〜 și fără spații. Harta stă în i18n/languages.json („semne”); o citesc și interfața, și serverul.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { glueWith } from '../web/src/app/core/glue.ts';
import { splitLines } from '../web/src/app/pages/porumbel-form/split-lines.ts';
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

test('câmpul „Linii”: virgula obișnuită și cele japoneze (、 ，) despart; restul rămâne', () => {
  assert.deepEqual(splitLines('Janssen, Van Loon'), ['Janssen', 'Van Loon']);
  assert.deepEqual(splitLines('Janssen、Van Loon，Delbar、'), ['Janssen', 'Van Loon', 'Delbar']);
  assert.deepEqual(splitLines(['Janssen', 'Van Loon'].join(glue('ja', ', '))), ['Janssen', 'Van Loon'], 'ce se arată în japoneză se citește înapoi');
  assert.deepEqual(splitLines(' a; b / c ,'), ['a; b / c']);
  assert.deepEqual(splitLines(''), []);
});

// Cutiile .notice / .warning / .error sunt flex cu gap: o propoziție din mai multe bucăți are un singur înveliș `.flow`,
// un bloc în toate limbile, ca bucățile (text, <strong>) să curgă pe rânduri, fără goluri de 10px între ele.
test('propozițiile din cutii au învelișul `.flow`', () => {
  const css = fs.readFileSync(path.join(ROOT, 'web', 'src', 'styles.css'), 'utf8');
  assert.match(css, /^\.flow \{ display: block; flex: 1; min-width: 0; \}$/m);
  assert.doesNotMatch(css, /\.flow \{ display: contents/);
  assert.doesNotMatch(css, /html\[lang="ja"\] \.flow/);
  const dir = path.join(ROOT, 'web', 'src', 'app');
  const box = /<(div|p)\b[^>]*?(?:class="(?:notice|warning|error)(?! stack)[^"]*"|\[class\]="[^"]*'warning' : 'notice'")[^>]*>([\s\S]*?)<\/\1>/g;
  let found = 0;
  for (const f of fs.readdirSync(dir, { recursive: true })) {
    if (!f.endsWith('.ts') || f.startsWith(path.join('pages', 'admin'))) continue;
    for (const m of fs.readFileSync(path.join(dir, f), 'utf8').matchAll(box)) {
      if (!/<(strong|b|em)\b|<span class="mono"/.test(m[2])) continue;
      found += 1;
      assert.match(m[2], /<span class="flow">/, `${f}: ${m[2].trim().slice(0, 100)}`);
    }
  }
  assert.equal(found, 7);
});

// Meniul de jos pe telefon, în japoneză: coloane după text, iconiță de 44px. Un semn japonez are lățimea literei (1em).
test('meniul de jos: etichetele japoneze încap la 320px, cu literele de 14,4 / 16,2px', () => {
  const app = fs.readFileSync(path.join(ROOT, 'web', 'src', 'app', 'app.ts'), 'utf8');
  assert.match(app, /:host-context\(html\[lang="ja"\]\) \.bottom-nav \{ grid-auto-columns: auto; \}/);
  assert.match(app, /:host-context\(html\[lang="ja"\]\) \.bottom-nav a \.ico \{ width: 44px; \}/);
  const ja = JSON.parse(fs.readFileSync(path.join(ROOT, 'i18n', 'ja.json'), 'utf8'));
  const labels = ['panou', 'arbore', 'perechi', 'adauga', 'vanzari', 'cont'].map((k) => [...ja[`meniu.${k}`]].length);
  for (let on = 0; on < labels.length; on++) {
    const total = labels.reduce((sum, n, i) => sum + Math.max(44, n * 18 * (i === on ? 0.9 : 0.8)), 0);
    assert.ok(total <= 320, `${total}px cu butonul ${on} aprins`);
  }
});

// Eticheta pentru cititoarele de ecran a codului QR vine din i18n, nu din româna scrisă în cod.
test('codul QR: eticheta de accesibilitate e cheie i18n în ro/hu/ja', () => {
  const src = fs.readFileSync(path.join(ROOT, 'web', 'src', 'app', 'shared', 'qr-code.ts'), 'utf8');
  assert.doesNotMatch(src, /Cod QR pentru/);
  assert.match(src, /t\('partajare\.qr_eticheta'/);
  for (const l of ['ro', 'hu', 'ja']) {
    const d = JSON.parse(fs.readFileSync(path.join(ROOT, 'i18n', `${l}.json`), 'utf8'));
    assert.match(d['partajare.qr_eticheta'], /\{url\}/, l);
  }
});
