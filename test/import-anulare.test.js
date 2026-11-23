import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { apiCaller } from './helpers/api.js';
import { startTestApp } from './helpers/db.js';
import { newAccount } from './helpers/accounts.js';

// Adu porumbeii din Excel: anularea ultimului import (7 zile) și curățarea evidenței. Inelele și numele sunt inventate.
let server;
let base;
const call = apiCaller(() => ({ base }));
before(async () => {
  ({ server, base } = await startTestApp());
});
after(() => server?.close());

const save = (cookie, body) => call('/api/import/excel', { method: 'POST', cookie, body });
const undo = (cookie) => call('/api/import/excel/undo', { method: 'POST', cookie });
const last = async (cookie) => (await call('/api/import/excel/last', { cookie })).data.last;
const rows = (...list) => list.map((r, i) => ({ line: i + 2, ring: '', ...r }));
const pigeons = async (cookie) => (await call('/api/pigeons', { cookie })).data.pigeons;
const pigeon = async (cookie, id) => (await call(`/api/pigeons/${id}`, { cookie })).data.pigeon;
const byRing = async (cookie, display) => (await pigeons(cookie)).find((p) => p.ring?.display === display);
const accountId = async (cookie) => (await call('/api/auth/me', { cookie })).data.account.id;
const newPigeon = async (cookie, body) => {
  const r = await call('/api/pigeons', { method: 'POST', cookie, body: { kind: 'own', ...body } });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  return r.data.pigeon;
};
const imported = async (cookie, body) => {
  const r = await save(cookie, body);
  assert.equal(r.status, 201, JSON.stringify(r.data));
  return r.data;
};

test('anularea șterge ce a adus', async () => {
  const a = await newAccount(call, 'A');
  const mine = await newPigeon(a, { ring: 'RO-24-400001', name: 'Scris de mână' });
  const s = await imported(a, {
    rows: rows(
      { ring: 'RO-24-400002', name: 'Nou unu', color: 'albastru' },
      { ring: 'RO-24-400003', sex: 'F' },
      { ring: 'RO-24-400001', name: 'Alt nume', color: 'albastru' },
    ),
  });
  assert.equal(s.created, 2);
  assert.equal(s.existing, 1);
  const filled = await pigeon(a, mine.id);
  assert.equal(filled.color, 'albastru');
  assert.equal(filled.name, 'Scris de mână');

  const l = await last(a);
  assert.equal(l.id, s.importId);
  assert.equal(l.created, 2);
  assert.equal(Date.parse(l.undoUntil) - Date.parse(l.createdAt), 7 * 24 * 3600 * 1000);

  const u = await undo(a);
  assert.equal(u.status, 200, JSON.stringify(u.data));
  assert.deepEqual(u.data, { deleted: 2, kept: 0, cleared: 1, reverted: 0 });
  const left = await pigeons(a);
  assert.deepEqual(left.map((p) => p.id), [mine.id]);
  const back = await pigeon(a, mine.id);
  assert.equal(back.color, null, 'culoarea completată de import se golește');
  assert.equal(back.name, 'Scris de mână', 'numele scris de mână rămâne');
  assert.equal((await byRing(a, 'RO-24-400001')).id, mine.id, 'căutarea după inel merge și după anulare');
  assert.equal(await last(a), null);
});

test('anularea păstrează porumbeii folosiți', async () => {
  const a = await newAccount(call, 'A');
  const s = await imported(a, {
    rows: rows(
      { ring: 'RO-24-410001' },
      { ring: 'RO-24-410002', name: 'Primul nume' },
      { ring: 'RO-24-410003', sex: 'M' },
      { ring: 'RO-24-410004' },
      { ring: 'RO-24-410005' },
    ),
  });
  assert.equal(s.created, 5);
  const [p1, p2, p3] = await Promise.all(['RO-24-410001', 'RO-24-410002', 'RO-24-410003'].map((r) => byRing(a, r)));
  const j = await call(`/api/pigeons/${p1.id}/journal`, { method: 'POST', cookie: a, body: { date: '2026-03-01', type: 'nota', text: 'Formă bună' } });
  assert.equal(j.status, 201, JSON.stringify(j.data));
  const ren = await call(`/api/pigeons/${p2.id}`, { method: 'PATCH', cookie: a, body: { name: 'Redenumit' } });
  assert.equal(ren.status, 200, JSON.stringify(ren.data));
  const hen = await newPigeon(a, { ring: 'RO-23-410100', sex: 'F' });
  const pair = await call('/api/pairs', { method: 'POST', cookie: a, body: { cockId: p3.id, henId: hen.id, pairedOn: '2026-02-10' } });
  assert.equal(pair.status, 201, JSON.stringify(pair.data));

  const u = await undo(a);
  assert.equal(u.status, 200, JSON.stringify(u.data));
  assert.deepEqual(u.data, { deleted: 2, kept: 3, cleared: 0, reverted: 0 });
  const left = (await pigeons(a)).map((p) => p.ring.display).sort();
  assert.deepEqual(left, ['RO-23-410100', 'RO-24-410001', 'RO-24-410002', 'RO-24-410003']);
  assert.equal((await pigeon(a, p2.id)).name, 'Redenumit');
  assert.equal(await last(a), null, 'după anulare, butonul dispare');
});

test('legăturile spre porumbeii importului', async () => {
  const a = await newAccount(call, 'A');
  await imported(a, {
    rows: rows(
      { ring: 'RO-24-420001', father: 'RO-20-420100' },
      { ring: 'RO-24-420002', mother: 'RO-20-420200' },
      { ring: 'RO-24-420003', sex: 'M' },
      { ring: 'RO-24-420004' },
    ),
  });
  const c = await byRing(a, 'RO-24-420001');
  const e = await byRing(a, 'RO-24-420003');
  const f = await byRing(a, 'RO-24-420004');
  // C e folosit (jurnal), deci și tatăl lui (strămoș adus de import) rămâne: altfel C și-ar pierde tatăl.
  assert.equal((await call(`/api/pigeons/${c.id}/journal`, { method: 'POST', cookie: a, body: { date: '2026-03-01', type: 'nota', text: 'x' } })).status, 201);
  // E e tatăl unui porumbel trecut de mână: o legătură făcută altfel decât de import.
  const child = await newPigeon(a, { ring: 'RO-25-420500' });
  const link = await call(`/api/pigeons/${child.id}/parents`, { method: 'PUT', cookie: a, body: { fatherId: e.id, motherId: null } });
  assert.equal(link.status, 200, JSON.stringify(link.data));
  // F are link public.
  assert.equal((await call(`/api/pigeons/${f.id}/public`, { method: 'POST', cookie: a })).status, 200);

  const u = await undo(a);
  assert.equal(u.status, 200, JSON.stringify(u.data));
  // D și mama lui (adusă de import) pleacă; C, tatăl lui, E și F rămân.
  assert.deepEqual(u.data, { deleted: 2, kept: 4, cleared: 0, reverted: 0 });
  const left = (await pigeons(a)).map((p) => p.ring.display).sort();
  assert.deepEqual(left, ['RO-20-420100', 'RO-24-420001', 'RO-24-420003', 'RO-24-420004', 'RO-25-420500']);
  assert.equal((await pigeon(a, c.id)).fatherId, (await byRing(a, 'RO-20-420100')).id);
  assert.equal((await pigeon(a, child.id)).fatherId, e.id);
});

test('legăturile completate se golesc, cele schimbate rămân', async () => {
  const a = await newAccount(call, 'A');
  const x = await newPigeon(a, { ring: 'RO-24-440001' });
  const y = await newPigeon(a, { ring: 'RO-24-440002' });
  const dad = await newPigeon(a, { ring: 'RO-20-440100' });
  const other = await newPigeon(a, { ring: 'RO-20-440101', sex: 'M' });
  await imported(a, {
    rows: rows(
      { ring: 'RO-24-440001', father: 'RO-20-440100' },
      { ring: 'RO-24-440002', father: 'RO-20-440100', lines: 'Janssen' },
    ),
  });
  assert.equal((await pigeon(a, x.id)).fatherId, dad.id);
  assert.equal((await pigeon(a, dad.id)).sex, 'M', 'tatăl primește sexul din legătură');
  // Y primește de mână alt tată: legătura nu mai e cea pusă de import.
  assert.equal((await call(`/api/pigeons/${y.id}/parents`, { method: 'PUT', cookie: a, body: { fatherId: other.id, motherId: null } })).status, 200);

  const u = await undo(a);
  assert.equal(u.status, 200, JSON.stringify(u.data));
  assert.deepEqual(u.data, { deleted: 0, kept: 0, cleared: 3, reverted: 0 });
  assert.equal((await pigeon(a, x.id)).fatherId, null);
  const yb = await pigeon(a, y.id);
  assert.equal(yb.fatherId, other.id);
  assert.deepEqual(yb.lines, []);
  assert.equal((await pigeon(a, dad.id)).sex, null, 'sexul pus de import se golește când nu mai e tatăl nimănui');
});

test('doar ultimul import', async () => {
  const a = await newAccount(call, 'A');
  const first = await imported(a, { rows: rows({ ring: 'RO-24-450001' }) });
  const second = await imported(a, { rows: rows({ ring: 'RO-24-450002' }, { ring: 'RO-24-450001', name: 'Din al doilea' }) });
  assert.equal((await last(a)).id, second.importId);
  assert.notEqual(first.importId, second.importId);
  const u = await undo(a);
  assert.equal(u.status, 200, JSON.stringify(u.data));
  assert.deepEqual(u.data, { deleted: 1, kept: 0, cleared: 1, reverted: 0 });
  const left = await pigeons(a);
  assert.deepEqual(left.map((p) => p.ring.display), ['RO-24-450001']);
  assert.equal(left[0].name, null);
  assert.equal(await last(a), null, 'importul de dinainte nu se mai poate anula');
  const again = await undo(a);
  assert.equal(again.status, 404);
  assert.match(again.data.error, /anula/i);
  assert.equal((await pigeons(a)).length, 1);
});

test('un import care nu schimbă nimic nu ia anularea celui adevărat', async () => {
  const a = await newAccount(call, 'A');
  const body = { rows: rows({ ring: 'RO-24-460001', name: 'Unu' }, { ring: 'RO-24-460002' }) };
  const first = await imported(a, body);
  const again = await imported(a, body);
  assert.equal(again.importId, undefined);
  assert.equal(again.existing, 2);
  assert.equal((await last(a)).id, first.importId);
  const u = await undo(a);
  assert.equal(u.status, 200, JSON.stringify(u.data));
  assert.deepEqual(u.data, { deleted: 2, kept: 0, cleared: 0, reverted: 0 });
  assert.equal((await pigeons(a)).length, 0);
});

test('7 zile', async () => {
  const { run, one } = await import('../src/db.js');
  const { pruneImports } = await import('../src/table-import.js');
  const a = await newAccount(call, 'A');
  const s = await imported(a, { rows: rows({ ring: 'RO-24-460001' }) });
  const fresh = await imported(await newAccount(call, 'B'), { rows: rows({ ring: 'RO-24-460002' }) });
  await run(`UPDATE excel_imports SET created_at = now() - interval '8 days' WHERE id = ?`, s.importId);
  assert.equal(await last(a), null);
  assert.equal((await undo(a)).status, 404);
  assert.ok((await pruneImports()) >= 1);
  assert.equal(await one('SELECT 1 FROM excel_imports WHERE id = ?', s.importId), undefined);
  assert.equal(await one('SELECT 1 FROM excel_import_items WHERE import_id = ?', s.importId), undefined);
  assert.ok(await one('SELECT 1 FROM excel_imports WHERE id = ?', fresh.importId), 'importul de azi rămâne');
  assert.equal((await pigeons(a)).length, 1, 'porumbeii rămân, doar evidența pleacă');
});

test('strămoș făcut propriu', async () => {
  const a = await newAccount(call, 'A');
  await imported(a, { rows: rows({ ring: 'RO-24-470001', father: 'RO-20-470100', mother: 'RO-20-470200' }) });
  const dad = await byRing(a, 'RO-20-470100');
  const mom = await byRing(a, 'RO-20-470200');
  assert.equal(dad.kind, 'external');
  await imported(a, { rows: rows({ ring: 'RO-20-470100', name: 'Tatăl' }, { ring: 'RO-20-470200', color: 'albastru' }) });
  assert.equal((await pigeon(a, dad.id)).kind, 'own');
  assert.equal((await pigeon(a, mom.id)).kind, 'own');
  // Mama e folosită ca porumbel propriu după import (jurnal): rămâne a ta, dar culoarea pusă de import se golește.
  assert.equal((await call(`/api/pigeons/${mom.id}/journal`, { method: 'POST', cookie: a, body: { date: '2026-03-01', type: 'nota', text: 'x' } })).status, 201);

  const u = await undo(a);
  assert.equal(u.status, 200, JSON.stringify(u.data));
  assert.deepEqual(u.data, { deleted: 0, kept: 1, cleared: 1, reverted: 1 });
  const d = await pigeon(a, dad.id);
  assert.equal(d.kind, 'external');
  assert.equal(d.name, null);
  assert.equal(d.sex, 'M', 'sexul strămoșului (pus la primul import) rămâne');
  const m = await pigeon(a, mom.id);
  assert.equal(m.kind, 'own');
  assert.equal(m.color, null);
  assert.equal((await pigeon(a, (await byRing(a, 'RO-24-470001')).id)).fatherId, dad.id, 'legătura copilului rămâne');
});

test('strămoș făcut propriu și schimbat de mână: rămâne propriu, dar ce a pus importul se golește', async () => {
  const a = await newAccount(call, 'A');
  await imported(a, { rows: rows({ ring: 'RO-24-471001', father: 'RO-20-471100', mother: 'RO-20-471200' }) });
  const x = await byRing(a, 'RO-20-471100');
  const y = await byRing(a, 'RO-20-471200');
  // Al doilea import face proprii ambii strămoși, le completează numele și culoarea și le dă câte un tată nou.
  await imported(a, {
    rows: rows(
      { ring: 'RO-20-471100', name: 'A', color: 'albastru', father: 'RO-18-471900' },
      { ring: 'RO-20-471200', name: 'B', color: 'albastru', father: 'RO-18-471901' },
    ),
  });
  const xi = await pigeon(a, x.id);
  assert.equal(xi.kind, 'own');
  assert.ok(xi.fatherId, 'tatăl lui X pus de import');
  // X: culoarea corectată de mână. Y: folosit după import (jurnal).
  assert.equal((await call(`/api/pigeons/${x.id}`, { method: 'PATCH', cookie: a, body: { color: 'solzat' } })).status, 200);
  assert.equal((await call(`/api/pigeons/${y.id}/journal`, { method: 'POST', cookie: a, body: { date: '2026-03-01', type: 'nota', text: 'x' } })).status, 201);

  const u = await undo(a);
  assert.equal(u.status, 200, JSON.stringify(u.data));
  // Rămân proprii (kept), cu numele și legătura puse de import golite (cleared); tații aduși de import pleacă.
  assert.deepEqual(u.data, { deleted: 2, kept: 2, cleared: 2, reverted: 0 });
  const xb = await pigeon(a, x.id);
  assert.equal(xb.kind, 'own');
  assert.equal(xb.name, null, 'numele pus de import se golește');
  assert.equal(xb.color, 'solzat', 'culoarea scrisă de mână rămâne');
  assert.equal(xb.fatherId, null, 'legătura pusă de import se golește');
  const yb = await pigeon(a, y.id);
  assert.equal(yb.kind, 'own');
  assert.equal(yb.name, null);
  assert.equal(yb.color, null);
  assert.equal(yb.fatherId, null);
  assert.equal(await byRing(a, 'RO-18-471900'), undefined);
  assert.equal(await byRing(a, 'RO-18-471901'), undefined);
});

test('separare', async () => {
  const a = await newAccount(call, 'A');
  const b = await newAccount(call, 'B');
  await imported(a, { rows: rows({ ring: 'RO-24-480001' }) });
  assert.equal(await last(b), null);
  assert.equal((await undo(b)).status, 404);
  assert.equal((await pigeons(a)).length, 1);
});

test('doar citire', async () => {
  const { run } = await import('../src/db.js');
  const x = await newAccount(call, 'X');
  await imported(x, { rows: rows({ ring: 'RO-24-490001' }) });
  await run(`UPDATE accounts SET subscription_start = '2000-01-01', subscription_end = '2001-01-01' WHERE id = ?`, await accountId(x));
  assert.equal((await undo(x)).status, 402);
  assert.ok(await last(x), 'ultimul import se vede și în doar citire');
  assert.equal((await pigeons(x)).length, 1);
  assert.equal((await call('/api/import/excel/undo', { method: 'POST', auth: 'none' })).status, 401);
});

test('anularea a 3000 de rânduri', async () => {
  const a = await newAccount(call, 'A');
  const fathers = Array.from({ length: 750 }, (_, i) => `RO-20-${500000 + i}`);
  const mothers = Array.from({ length: 750 }, (_, i) => `RO-20-${600000 + i}`);
  const children = Array.from({ length: 1500 }, (_, i) => ({ ring: `RO-24-${700000 + i}`, father: fathers[i % 750], mother: mothers[i % 750] }));
  const list = [...children, ...fathers.map((ring) => ({ ring, sex: 'M' })), ...mothers.map((ring) => ({ ring, sex: 'F' }))];
  const s = await imported(a, { rows: list.map((r, i) => ({ line: i + 2, ...r })) });
  assert.equal(s.created, 3000);
  const t0 = performance.now();
  const u = await undo(a);
  console.log(`# 3000 de porumbei anulați în ${Math.round(performance.now() - t0)} ms`);
  assert.equal(u.status, 200, JSON.stringify(u.data));
  assert.deepEqual(u.data, { deleted: 3000, kept: 0, cleared: 0, reverted: 0 });
  assert.equal((await pigeons(a)).length, 0);
});
