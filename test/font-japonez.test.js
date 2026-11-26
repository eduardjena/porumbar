// Fontul japonez: feliat (unicode-range), într-un CSS separat, adus doar când e nevoie; în PDF-ul fișei intră doar
// feliile cu literele de pe foaie (altfel s-ar încorpora toate, de mai mulți MB).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { parseFace, facesFor } from '../web/src/app/core/font-faces.ts';

const WEB = path.join(import.meta.dirname, '..', 'web');
const read = (...p) => fs.readFileSync(path.join(WEB, ...p), 'utf8');
const chars = (s) => new Set([...s].map((c) => c.codePointAt(0)));
const face = (family, weight, file, range) =>
  `@font-face { font-family: "${family}"; font-style: normal; font-display: swap; font-weight: ${weight}; src: url("media/${file}.woff2") format("woff2"), url("media/${file}.woff") format("woff");${range ? ` unicode-range: ${range};` : ''} }`;

test('CSS-ul fontului japonez are doar felii, iar styles.css (încărcat de toți) nu-l aduce', () => {
  const imports = [...read('src', 'japoneza.css').matchAll(/@import '([^']+)'/g)].map((m) => m[1]);
  assert.equal(imports.length, 2);
  for (const f of imports) {
    const faces = read('node_modules', f).split('@font-face').slice(1);
    assert.ok(faces.length > 50, `${f}: ${faces.length} felii`);
    for (const x of faces) assert.match(x, /unicode-range:/, `${f}: o felie fără unicode-range s-ar descărca la orice literă lipsă`);
  }
  assert.doesNotMatch(read('src', 'styles.css'), /@import[^;]*noto/);
});

test('parseFace: familia, greutatea, literele și fișierul woff2', () => {
  const f = parseFace(face('Noto Sans JP', 700, 'b', 'U+3041-3043, U+65E5, U+4??'));
  assert.equal(f.family, 'Noto Sans JP');
  assert.deepEqual(f.weight, [700, 700]);
  assert.deepEqual(f.range, [[0x3041, 0x3043], [0x65e5, 0x65e5], [0x400, 0x4ff]]);
  assert.equal(f.url, 'media/b.woff2');
  assert.deepEqual(parseFace(face('Atkinson', '200 800', 'a')).weight, [200, 800]);
  assert.equal(parseFace(face('Atkinson', '200 800', 'a')).range, null);
  assert.equal(parseFace('@font-face { font-family: X; src: local("X"); }'), null);
});

test('facesFor: doar feliile cu litere de pe foaie, la greutatea la care se scriu', () => {
  const all = [
    face('Noto Sans JP', 400, 'kana-400', 'U+3040-30FF'), face('Noto Sans JP', 700, 'kana-700', 'U+3040-30FF'),
    face('Noto Sans JP', 400, 'kanji-400', 'U+4E00-9FFF'), face('Noto Sans JP', 700, 'kanji-700', 'U+4E00-9FFF'),
    face('Atkinson', '200 800', 'latin', 'U+0-FF'), face('Alt font', 400, 'alt'),
  ].map(parseFace);
  const files = (texts, families = ['Atkinson', 'Noto Sans JP', 'system-ui']) =>
    facesFor(all, new Set(families), texts).map((f) => f.url.slice(6, -6));
  assert.deepEqual(files(new Map([[400, chars('RO-25 ハト')]])), ['kana-400', 'latin']);
  assert.deepEqual(files(new Map([[400, chars('ハト')], [800, chars('血統')]])), ['kana-400', 'kanji-700']);
  assert.deepEqual(files(new Map([[500, chars('鳩')]])), ['kanji-400']);
  assert.deepEqual(files(new Map([[600, chars('鳩')]])), ['kanji-700']);
  assert.deepEqual(files(new Map([[400, chars('RO ハト')]]), ['Atkinson']), ['latin']);
});
