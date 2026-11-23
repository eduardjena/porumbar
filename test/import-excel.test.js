import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { apiCaller } from './helpers/api.js';
import { startTestApp } from './helpers/db.js';
import { newAccount } from './helpers/accounts.js';

// Adu porumbeii din Excel: motorul de import (previzualizare și salvare). Inelele și numele sunt inventate.
let server;
let base;
const call = apiCaller(() => ({ base }));
before(async () => {
  ({ server, base } = await startTestApp());
});
after(() => server?.close());

const preview = (cookie, body) => call('/api/import/excel/preview', { method: 'POST', cookie, body });
const save = (cookie, body) => call('/api/import/excel', { method: 'POST', cookie, body });
const rows = (...list) => list.map((r, i) => ({ line: i + 2, ring: '', ...r }));
const pigeons = async (cookie) => (await call('/api/pigeons', { cookie })).data.pigeons;
const pigeon = async (cookie, id) => (await call(`/api/pigeons/${id}`, { cookie })).data.pigeon;
const byRing = async (cookie, display) => (await pigeons(cookie)).find((p) => p.ring?.display === display);
const accountId = async (cookie) => (await call('/api/auth/me', { cookie })).data.account.id;

test('previzualizarea nu salvează nimic', async () => {
  const a = await newAccount(call, 'A');
  const body = { rows: rows({ ring: 'RO-24-100001', name: 'Unu' }, { ring: 'RO-24-100002' }, { ring: 'RO-24-100003', sex: 'F' }) };
  const r = await preview(a, body);
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.created, 3);
  assert.equal(r.data.existing, 0);
  assert.equal(r.data.ancestors, 0);
  assert.equal(r.data.problemCount, 0);
  assert.equal(r.data.importId, undefined);
  assert.equal((await pigeons(a)).length, 0);
});

test('salvarea face ce a spus previzualizarea', async () => {
  const a = await newAccount(call, 'A');
  const body = {
    rows: rows(
      { ring: 'RO-24-200001', name: 'Unu', father: 'RO-20-200100', mother: 'RO-20-200101' },
      { ring: 'RO-24-200002', color: 'albastru' },
      { ring: '??' },
      { ring: 'RO-24-200003', sex: 'F' },
    ),
  };
  const p = await preview(a, body);
  assert.equal(p.status, 200, JSON.stringify(p.data));
  const s = await save(a, body);
  assert.equal(s.status, 201, JSON.stringify(s.data));
  assert.ok(Number.isInteger(s.data.importId));
  const { importId, ...rest } = s.data;
  assert.deepEqual(rest, p.data);
  assert.equal(rest.created, 3);
  assert.equal(rest.ancestors, 2);
  const own = (await pigeons(a)).filter((x) => x.kind === 'own');
  assert.equal(own.length, 3);
});

test('părinți după copii și ciclu', async () => {
  const a = await newAccount(call, 'A');
  const r = await save(a, {
    rows: rows(
      { ring: 'RO-24-300001', father: 'RO-22-300100' },
      { ring: 'RO-22-300100', sex: 'M' },
      { ring: 'RO-23-300201', father: 'RO-23-300202' },
      { ring: 'RO-23-300202', father: 'RO-23-300201' },
    ),
  });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  assert.equal(r.data.created, 4);
  assert.equal(r.data.ancestors, 0);
  const child = await byRing(a, 'RO-24-300001');
  const father = await byRing(a, 'RO-22-300100');
  assert.equal((await pigeon(a, child.id)).fatherId, father.id);
  const x = await pigeon(a, (await byRing(a, 'RO-23-300201')).id);
  const y = await pigeon(a, (await byRing(a, 'RO-23-300202')).id);
  assert.equal([x.fatherId, y.fatherId].filter(Boolean).length, 1, 'o singură legătură');
  const conflicts = r.data.problems.filter((p) => p.kind === 'conflict');
  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0].line, 5);
  assert.ok(conflicts[0].message);
});

test('strămoși noi', async () => {
  const a = await newAccount(call, 'A');
  const r = await save(a, { rows: rows({ ring: 'RO-24-400001', mother: 'NL-20-400999' }) });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  assert.equal(r.data.created, 1);
  assert.equal(r.data.ancestors, 1);
  const child = await pigeon(a, (await byRing(a, 'RO-24-400001')).id);
  const mother = await pigeon(a, child.motherId);
  assert.equal(mother.kind, 'external');
  assert.equal(mother.sex, 'F');
  assert.equal(mother.ring.display, 'NL-20-400999');
});

test('există deja: doar câmpurile goale', async () => {
  const a = await newAccount(call, 'A');
  const made = await call('/api/pigeons', { method: 'POST', cookie: a, body: { kind: 'own', ring: 'RO-24-500001', name: 'Fulger' } });
  assert.equal(made.status, 201);
  const r = await save(a, { rows: rows({ ring: 'RO 24 500001', name: 'Altul', color: 'albastru' }) });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  assert.equal(r.data.existing, 1);
  assert.equal(r.data.created, 0);
  const p = await pigeon(a, made.data.pigeon.id);
  assert.equal(p.name, 'Fulger');
  assert.equal(p.color, 'albastru');
  assert.equal((await pigeons(a)).length, 1);
});

test('strămoș din alt porumbar devine propriu; sexul diferit e o nepotrivire', async () => {
  const a = await newAccount(call, 'A');
  const ext = (await call('/api/pigeons', { method: 'POST', cookie: a, body: { kind: 'external', ring: 'BE-19-500100', sex: 'M' } })).data.pigeon;
  const r = await save(a, { rows: rows({ ring: 'BE-19-500100', sex: 'F', name: 'Vechi' }) });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  assert.equal(r.data.existing, 1);
  const p = await pigeon(a, ext.id);
  assert.equal(p.kind, 'own');
  assert.equal(p.sex, 'M');
  assert.equal(p.name, 'Vechi');
  assert.deepEqual(r.data.problems.map((x) => x.kind), ['conflict']);
});

test('fără inel și inel necitit', async () => {
  const a = await newAccount(call, 'A');
  const r = await save(a, {
    defaultCountry: 'HU',
    rows: rows(
      { ring: '', name: 'Doar nume' },
      { ring: '??' },
      { ring: 'HU-24-12345' },
      { ring: '24-12346' },
      {},
      { ring: 'ABC 77 XYZ', name: 'Scris ciudat' },
    ),
  });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  const kinds = r.data.problems.map((p) => [p.line, p.kind]);
  assert.deepEqual(kinds, [
    [2, 'fara_inel'],
    [3, 'inel_necitit'],
    [4, 'inel_necitit'],
    [5, 'inel_necitit'],
    [7, 'inel_necitit'],
  ]);
  assert.equal(r.data.problems[0].ring, null);
  assert.equal(r.data.problemCount, 5);
  // Inelul scris, dar necitit, cu cheie de rezervă: adăugat cum e scris.
  assert.equal(r.data.created, 1);
  const all = await pigeons(a);
  assert.deepEqual(all.map((p) => p.ring.display), ['ABC 77 XYZ']);
});

test('țara implicită', async () => {
  const a = await newAccount(call, 'A');
  const r = await save(a, { defaultCountry: 'RO', rows: rows({ ring: '24-0117345' }, { ring: 'BE 19 6080187' }) });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  assert.equal(r.data.created, 2);
  assert.equal(r.data.problemCount, 0);
  const displays = (await pigeons(a)).map((p) => p.ring.display).sort();
  // formatRing scrie numărul românesc fără zerourile din față (cheia e aceeași).
  assert.deepEqual(displays, ['BE-19-6080187', 'RO-24-117345']);
  // O țară necunoscută se ignoră.
  const b = await newAccount(call, 'B');
  const x = await preview(b, { defaultCountry: 'XX', rows: rows({ ring: '24-0117345' }) });
  assert.equal(x.status, 200);
  assert.deepEqual(x.data.problems.map((p) => p.kind), ['inel_necitit']);
});

test('dubluri în tabel', async () => {
  const a = await newAccount(call, 'A');
  const r = await save(a, { rows: rows({ ring: 'RO-24-600001', name: 'Primul' }, { ring: 'RO 24 600001', name: 'Al doilea' }) });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  assert.equal(r.data.created, 1);
  assert.deepEqual(r.data.problems.map((p) => [p.line, p.kind]), [[3, 'dublura']]);
  assert.equal((await byRing(a, 'RO-24-600001')).name, 'Primul');
});

test('părinte cu inel necitit, părinte de sex greșit, altă legătură existentă', async () => {
  const a = await newAccount(call, 'A');
  const old = (await call('/api/pigeons', { method: 'POST', cookie: a, body: { kind: 'external', ring: 'RO-19-700900', sex: 'M' } })).data.pigeon;
  const child = (await call('/api/pigeons', { method: 'POST', cookie: a, body: { kind: 'own', ring: 'RO-24-700001', fatherId: null } })).data.pigeon;
  await call(`/api/pigeons/${child.id}/parents`, { method: 'PUT', cookie: a, body: { fatherId: old.id } });
  const r = await save(a, {
    rows: rows(
      { ring: 'RO-24-700001', father: 'RO-19-700901' },
      { ring: 'RO-24-700002', mother: 'HU-24-123' },
      { ring: 'RO-24-700003', sex: 'M' },
      { ring: 'RO-24-700004', mother: 'RO-24-700003', father: '-' },
    ),
  });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  const kinds = r.data.problems.map((p) => [p.line, p.kind]);
  assert.ok(kinds.some(([l, k]) => l === 2 && k === 'conflict'), JSON.stringify(kinds));
  assert.equal(r.data.ancestors, 0, 'tatăl din tabel nu se face când porumbelul are deja alt tată');
  assert.equal((await pigeon(a, child.id)).fatherId, old.id);
  assert.ok(kinds.some(([l, k]) => l === 3 && k === 'parinte_necitit'), JSON.stringify(kinds));
  assert.ok(kinds.some(([l, k]) => l === 5 && k === 'conflict'), JSON.stringify(kinds));
  const c4 = await pigeon(a, (await byRing(a, 'RO-24-700004')).id);
  assert.equal(c4.motherId, null);
  assert.equal(c4.fatherId, null, '„-” nu e un inel');
});

test('jurnalul importului: creat, completat, făcut propriu', async () => {
  const { all } = await import('../src/db.js');
  const a = await newAccount(call, 'A');
  const ext = (await call('/api/pigeons', { method: 'POST', cookie: a, body: { kind: 'external', ring: 'RO-18-800100', sex: 'M' } })).data.pigeon;
  const own = (await call('/api/pigeons', { method: 'POST', cookie: a, body: { kind: 'own', ring: 'RO-24-800002', name: 'Fulger' } })).data.pigeon;
  const r = await save(a, {
    rows: rows(
      { ring: 'RO-24-800001', name: 'Nou', father: 'RO-18-800100', lines: 'Janssen; Delbar' },
      { ring: 'RO-18-800100', name: 'Bătrân' },
      { ring: 'RO-24-800002', name: 'Altul', color: 'albastru' },
    ),
  });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  const items = await all('SELECT pigeon_id, action, fields FROM excel_import_items WHERE import_id = ? ORDER BY pigeon_id', r.data.importId);
  assert.equal(items.length, 3);
  const created = items.find((i) => i.action === 'created');
  const nou = await byRing(a, 'RO-24-800001');
  assert.equal(created.pigeon_id, nou.id);
  assert.equal(created.fields.kind, 'own');
  assert.equal(created.fields.name, 'Nou');
  assert.equal(created.fields.ring_key, 'RO|2024||800001');
  assert.equal(created.fields.father_id, ext.id);
  assert.equal(created.fields.mother_id, null);
  assert.equal(created.fields.breed, 'voiajor');
  assert.deepEqual(created.fields.lines, ['Janssen', 'Delbar']);
  const converted = items.find((i) => i.action === 'converted');
  assert.equal(converted.pigeon_id, ext.id);
  assert.deepEqual(converted.fields, { prev_kind: 'external', kind: 'own', name: 'Bătrân' });
  const filled = items.find((i) => i.action === 'filled');
  assert.equal(filled.pigeon_id, own.id);
  assert.deepEqual(filled.fields, { color: 'albastru' });
  const imp = await all('SELECT account_id, undone_at, summary FROM excel_imports WHERE id = ?', r.data.importId);
  assert.equal(imp[0].account_id, await accountId(a));
  assert.equal(imp[0].undone_at, null);
  assert.equal(imp[0].summary.created, 1);
});

test('limite', async () => {
  const a = await newAccount(call, 'A');
  const many = Array.from({ length: 3001 }, (_, i) => ({ line: i + 2, ring: `RO-24-${900000 + i}` }));
  const big = await save(a, { rows: many });
  assert.equal(big.status, 400);
  assert.match(big.data.error, /3000/);
  assert.equal((await preview(a, { rows: [] })).status, 400);
  assert.equal((await preview(a, {})).status, 400);
  // O celulă prea lungă se taie, nu se refuză.
  const long = await preview(a, { rows: rows({ ring: 'RO-24-910001', name: 'x'.repeat(5000), notes: 'y'.repeat(5000) }) });
  assert.equal(long.status, 200, JSON.stringify(long.data));
  assert.equal(long.data.created, 1);
  // Cel mult 100 de probleme în listă; numărul lor e întreg.
  const bad = await preview(a, { rows: Array.from({ length: 150 }, (_, i) => ({ line: i + 2, ring: '??' })) });
  assert.equal(bad.status, 200);
  assert.equal(bad.data.problems.length, 100);
  assert.equal(bad.data.problemCount, 150);
  const b = await newAccount(call, 'B');
  const one = { rows: rows({ ring: 'RO-24-920001' }) };
  for (let i = 0; i < 30; i++) assert.equal((await preview(b, one)).status, 200);
  assert.equal((await preview(b, one)).status, 429);
  assert.equal((await save(b, one)).status, 201, 'salvarea nu intră în limita previzualizărilor');
});

test('doar citire', async () => {
  const { run } = await import('../src/db.js');
  const body = { rows: rows({ ring: 'RO-24-950001' }) };
  const y = await newAccount(call, 'Y', { active: false });
  assert.equal((await preview(y, body)).status, 402);
  assert.equal((await save(y, body)).status, 402);
  const x = await newAccount(call, 'X');
  await run(`UPDATE accounts SET subscription_start = '2000-01-01', subscription_end = '2001-01-01' WHERE id = ?`, await accountId(x));
  assert.equal((await preview(x, body)).status, 402);
  assert.equal((await save(x, body)).status, 402);
  assert.equal((await pigeons(x)).length, 0);
  assert.equal((await call('/api/import/excel', { method: 'POST', auth: 'none', body })).status, 401);
});

test('separare', async () => {
  const a = await newAccount(call, 'A');
  const b = await newAccount(call, 'B');
  const mine = (await call('/api/pigeons', { method: 'POST', cookie: a, body: { kind: 'own', ring: 'RO-24-960001', name: 'Al lui A' } })).data.pigeon;
  const r = await save(b, { rows: rows({ ring: 'RO-24-960001', name: 'Al lui B', color: 'albastru' }) });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  assert.equal(r.data.created, 1);
  assert.equal(r.data.existing, 0);
  const theirs = await byRing(b, 'RO-24-960001');
  assert.notEqual(theirs.id, mine.id);
  assert.equal(theirs.name, 'Al lui B');
  const again = await pigeon(a, mine.id);
  assert.equal(again.name, 'Al lui A');
  assert.equal(again.color, null);
  assert.equal((await pigeons(a)).length, 1);
});

test('3000 de rânduri', async () => {
  const { one } = await import('../src/db.js');
  const a = await newAccount(call, 'A');
  const fathers = Array.from({ length: 750 }, (_, i) => `RO-20-${100000 + i}`);
  const mothers = Array.from({ length: 750 }, (_, i) => `RO-20-${200000 + i}`);
  const children = Array.from({ length: 1500 }, (_, i) => ({ ring: `RO-24-${300000 + i}`, father: fathers[i % 750], mother: mothers[i % 750] }));
  // Copiii întâi, părinții după ei.
  const list = [...children, ...fathers.map((ring) => ({ ring, sex: 'M' })), ...mothers.map((ring) => ({ ring, sex: 'F' }))];
  const body = { rows: list.map((r, i) => ({ line: i + 2, ...r })) };
  const t0 = performance.now();
  const r = await save(a, body);
  const ms = performance.now() - t0;
  console.log(`# 3000 de rânduri salvate în ${Math.round(ms)} ms`);
  assert.equal(r.status, 201, JSON.stringify(r.data).slice(0, 500));
  assert.equal(r.data.created, 3000);
  assert.equal(r.data.ancestors, 0);
  assert.equal(r.data.problemCount, 0);
  assert.ok(ms <= 20_000, `${ms} ms`);
  const id = await accountId(a);
  const linked = await one('SELECT count(*)::int AS n FROM pigeons WHERE account_id = ? AND father_id IS NOT NULL AND mother_id IS NOT NULL', id);
  assert.equal(linked.n, 1500);
});
