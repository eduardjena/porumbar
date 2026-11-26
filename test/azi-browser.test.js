// „Azi” în browser: după ora țării contului (la fel ca pe server), nu după ceasul telefonului și nu pe UTC.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const APP = path.join(import.meta.dirname, '..', 'web', 'src', 'app');
const rel = (f) => path.relative(APP, f).split(path.sep).join('/');

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : p.endsWith('.ts') ? [p] : [];
  });
}

test('azi în browser: fără new Date().toISOString().slice(0, 10) și fără ceasul telefonului pentru „azi”', () => {
  for (const f of walk(APP)) {
    const r = rel(f);
    if (r.startsWith('pages/admin/')) continue;
    const text = fs.readFileSync(f, 'utf8');
    assert.ok(!/new Date\(\)\.toISOString\(\)\.slice\(0, 10\)/.test(text), `${r}: „azi” pe UTC`);
    assert.ok(!/const n = new Date\(\);\s*return[^;]*getDate\(\)/.test(text), `${r}: „azi” pe ceasul telefonului`);
  }
});

test('azi în browser: core/today.ts folosește zona contului, iar cele 7 locuri îl importă', () => {
  const today = fs.readFileSync(path.join(APP, 'core/today.ts'), 'utf8');
  assert.match(today, /zoneOf/);
  assert.match(today, /todayIn/);
  assert.match(today, /export function todayIso/);
  for (const f of [
    'pages/concurs/concurs-rezultate.ts', 'pages/perechi/pereche.ts', 'pages/perechi/perechi.ts',
    'pages/porumbel/porumbel.ts', 'pages/porumbel/rezultat-editor.ts', 'pages/tratamente/tratament-text.ts', 'shared/date-field.ts',
  ]) {
    const text = fs.readFileSync(path.join(APP, f), 'utf8');
    assert.match(text, /import \{[^}]*\btodayIso\b[^}]*\} from '[./]+\/core\/today'/, `${f}: nu importă todayIso din core/today`);
  }
});
