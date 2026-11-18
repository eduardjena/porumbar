import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { apiCaller } from './helpers/api.js';
import { startTestApp } from './helpers/db.js';
import { t, LANGS, isLang, isPublicLang, localeOf, __setForTest } from '../src/i18n.js';

// Dicționarele: i18n/ro.json (cu sensuri) și câte un fișier pentru fiecare limbă nouă.
const DIR = path.join(import.meta.dirname, '..', 'i18n');
const read = (lang) => JSON.parse(fs.readFileSync(path.join(DIR, `${lang}.json`), 'utf8'));

let server;
let base;
const call = apiCaller(() => ({ base }));
before(async () => {
  ({ server, base } = await startTestApp());
});
after(() => server?.close());

test('texte cu valori, în limba cerută', () => {
  assert.equal(t('ro', 'test.salut', { nume: 'Ion' }), 'Bună, Ion!');
  assert.equal(t('hu', 'test.salut', { nume: 'Ion' }), 'Szia, Ion!');
});

test('pluralul după regulile limbii', () => {
  assert.equal(t('ro', 'test.porumbei', { count: 1 }), '1 porumbel');
  assert.equal(t('ro', 'test.porumbei', { count: 2 }), '2 porumbei');
  assert.equal(t('ro', 'test.porumbei', { count: 20 }), '20 de porumbei');
  assert.equal(t('hu', 'test.porumbei', { count: 20 }), '20 galamb');
});

test('o cheie lipsă într-o limbă se arată în română; una necunoscută, ca cheie', () => {
  __setForTest('ro', 'test.doar_ro', 'Doar în română');
  assert.equal(t('hu', 'test.doar_ro'), 'Doar în română');
  assert.equal(t('hu', 'test.nu_exista'), 'test.nu_exista');
  assert.equal(t('xx', 'test.salut', { nume: 'A' }), 'Bună, A!');
});

test('lista limbilor: româna publică, maghiara în probă', () => {
  assert.deepEqual(LANGS.map((l) => l.code), ['ro', 'hu']);
  assert.equal(isLang('hu'), true);
  assert.equal(isLang('xx'), false);
  assert.equal(isPublicLang('ro'), true);
  assert.equal(isPublicLang('hu'), false);
  assert.equal(localeOf('hu'), 'hu-HU');
});

const forms = (v) => (typeof v === 'string' ? [v] : Object.entries(v).filter(([k]) => k !== 'sens').map(([k, x]) => (k === 'text' ? x : x)));
const placeholders = (v) => [...new Set(forms(v).flatMap((s) => [...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1])))].sort();

test('fiecare limbă are exact cheile din română, cu aceleași valori {…}, fără texte goale', () => {
  const ro = read('ro');
  for (const { code } of LANGS) {
    const d = read(code);
    assert.deepEqual(Object.keys(d).sort(), Object.keys(ro).sort(), `cheile din ${code}.json`);
    for (const k of Object.keys(ro)) {
      assert.deepEqual(placeholders(d[k]), placeholders(ro[k]), `${code}: valorile din „${k}”`);
      for (const f of forms(d[k])) assert.ok(typeof f === 'string' && f.trim(), `${code}: „${k}” e gol`);
    }
  }
});

test('dicționarul se poate cere de la server, fără sensuri', async () => {
  const hu = await call('/i18n/hu.json', { auth: 'none' });
  assert.equal(hu.status, 200);
  assert.equal(hu.data['test.salut'], 'Szia, {nume}!');
  const ro = await call('/i18n/ro.json', { auth: 'none' });
  assert.equal(ro.data['test.salut'], 'Bună, {nume}!');
  assert.ok(!JSON.stringify(ro.data).includes('"sens"'));
  assert.equal((await call('/i18n/xx.json', { auth: 'none' })).status, 404);
});
