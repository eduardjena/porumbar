// Japoneza (în lucru): pe grupe de chei. O grupă intră în DONE când e tradusă; atunci se verifică prezența,
// aceleași {…}, nenul și (în afară de ALLOW_NONJA) kana/kanji. `test.*` nu e în nicio grupă (fixturi comune).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const DIR = path.join(import.meta.dirname, '..', 'i18n');
const read = (lang) => JSON.parse(fs.readFileSync(path.join(DIR, `${lang}.json`), 'utf8'));

export const GROUPS = [
  { nume: 'domeniu', prefixe: ['catalog', 'culori', 'genetica', 'sex', 'camp', 'inel'] },
  { nume: 'shell', prefixe: ['cont', 'cont_nou', 'intra', 'parola_noua', 'parola_uitata', 'parola_camp', 'meniu', 'titlu', 'actiune', 'mail', 'banda', 'trimite', 'auth', 'push'] },
  { nume: 'panou', prefixe: ['panou', 'retea', 'text', 'vedere', 'drum'] },
  { nume: 'porumbel', prefixe: ['porumbel', 'form', 'parinti', 'cuib', 'amintiri', 'amintire', 'data', 'cip'] },
  { nume: 'perechi', prefixe: ['perechi', 'arbore', 'rezultate', 'concurs'] },
  { nume: 'vanzari', prefixe: ['tratamente', 'tratament', 'vanzari', 'vanzare', 'partajare', 'public', 'fisa', 'tiparire', 'pdf', 'hartie', 'toate'] },
  { nume: 'excel', prefixe: ['excel', 'import_excel', 'import', 'scan', 'cititor', 'eroare'] },
];

/** Grupele deja traduse (se completează task cu task). */
export const DONE = ['domeniu', 'shell'];

/** Chei a căror valoare japoneză poate fi fără kana/kanji (coduri, nume de marcă, doar substituenți, URL-uri). */
export const ALLOW_NONJA = new Set(['sex.m', 'sex.f', 'genetica.baza_si_desen', 'genetica.doar_desen',
  'cont.pana_pe', // doar semnul „〜” între data de început și cea de sfârșit
  'cont.de_pe', // doar semnul „：” între stare și dată
  'push.titlu', // numele aplicației (marcă), la fel în toate limbile
]);

export const isJapanese = (s) => /[぀-ヿ㐀-鿿ｦ-ﾟ]/.test(s);

const ro = read('ro');
const ja = read('ja');
/** Textul unei valori (șir, { text } sau plural: toate formele). */
const texts = (v) => (typeof v === 'string' ? [v] : typeof v?.text === 'string' ? [v.text] : Object.values(v ?? {}).map(String));
export const jaValue = (k) => texts(ja[k]);
const placeholders = (v) => [...new Set(texts(v).flatMap((s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1])))].sort();

for (const nume of DONE) {
  const grup = GROUPS.find((g) => g.nume === nume);
  test(`japoneză: grupa „${nume}” e completă`, () => {
    const keys = Object.keys(ro).filter((k) => grup.prefixe.includes(k.split('.')[0]));
    assert.ok(keys.length > 0, 'grupa nu are chei');
    for (const k of keys) {
      assert.ok(k in ja, `lipsește ${k}`);
      const vals = jaValue(k);
      assert.ok(vals.length > 0 && vals.every((s) => s.trim() !== ''), `${k} e gol`);
      assert.deepEqual(placeholders(ja[k]), placeholders(ro[k]), `${k}: {…} diferă de română`);
      if (!ALLOW_NONJA.has(k)) assert.ok(vals.some(isJapanese), `${k} nu conține japoneză: ${vals}`);
    }
  });
}

test('japoneză: ja.json e valid și are fixturile test.*', () => {
  assert.ok(ja['test.salut'] && ja['test.porumbei']);
});
