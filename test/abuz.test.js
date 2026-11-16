// Acțiuni aberante (stres): tipuri JSON greșite, texte uriașe, liste lungi, pedigree-uri ciudate, sume și date imposibile,
// id-uri ciudate, dublu-clic. Așteptat: 4xx cu mesaj în română, niciodată 500, nicio cerere agățată, nicio dată stricată.
// Testele care pică arată un defect real (numele lor spune comportamentul corect).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { apiCaller } from './helpers/api.js';
import { startTestApp } from './helpers/db.js';
import { adminCookie, newAccount } from './helpers/accounts.js';
import { PEDIGREE_FOTO } from './fixtures/pedigree-foto.js';

let server;
let base;
let a;
let admin;
const call = apiCaller(() => ({ base }));
before(async () => {
  ({ server, base } = await startTestApp());
  a = await newAccount(call, 'Abuz');
  admin = await adminCookie(call);
});
after(() => server?.close());

let seq = 100000;
const ring = () => `RO-25-${++seq}`;
const meOf = async (cookie) => (await call('/api/auth/me', { cookie })).data.account;
const emailOf = async (cookie) => (await meOf(cookie)).email;
const create = (cookie, body) => call('/api/pigeons', { method: 'POST', cookie, body });
const imp = (cookie, root, rootKind) => call('/api/pedigrees/import', { method: 'POST', cookie, body: { root, rootKind } });
const count = async (cookie) => (await call('/api/pigeons', { cookie })).data.pigeons.length;
const node = (r, father = null, mother = null, extra = {}) => ({ ring: r, father, mother, ...extra });

/** Răspuns 4xx cu mesaj text (nu 500, nu HTML). */
function clientError(r, what) {
  assert.ok(r.status >= 400 && r.status < 500, `${what}: ${r.status} ${JSON.stringify(r.data)}`);
  assert.equal(typeof r.data?.error, 'string', `${what}: fără mesaj ${r.buf.toString().slice(0, 200)}`);
}

// ---------------------------------------------------------------- tipuri greșite

test('fișa porumbelului: tipuri JSON greșite peste tot → 4xx cu mesaj, niciodată 500', async () => {
  const bodies = [
    { kind: 'own', ring: ['RO-25-1'] },
    { kind: 'own', ring: { a: 1 } },
    { kind: 'own', ring: 12345 },
    { kind: 'own', ring: true },
    { kind: ['own'], ring: ring() },
    { kind: null, ring: ring() },
    { kind: 'own', ring: ring(), name: 42 },
    { kind: 'own', ring: ring(), name: { x: 1 } },
    { kind: 'own', ring: ring(), sex: 'X' },
    { kind: 'own', ring: ring(), sex: ['M'] },
    { kind: 'own', ring: ring(), lines: 'linie' },
    { kind: 'own', ring: ring(), lines: [1, 2] },
    { kind: 'own', ring: ring(), lines: [[]] },
    { kind: 'own', ring: ring(), hatchedOn: 20250101 },
    { kind: 'own', ring: ring(), hatchedOn: '2025-02-30' },
    { kind: 'own', ring: ring(), hatchedOn: '99999-01-01' },
    { kind: 'own', ring: ring(), color: { code: 'x' } },
    { kind: 'own', ring: ring(), breed: 7 },
    { kind: 'own', ring: ring(), status: ['vandut'] },
    { kind: 'own', ring: ring(), evaluation: [] },
    { kind: 'own', ring: ring(), evaluation: 'bun' },
    { kind: 'own', ring: ring(), evaluation: { scores: { aripa: 9 } } },
    { kind: 'own', ring: ring(), evaluation: { scores: { aripa: '5' } } },
    { kind: 'own', ring: ring(), evaluation: { scores: { necunoscut: 3 } } },
    { kind: 'own', ring: ring(), evaluation: { scores: 'abc' } },
    { kind: 'own', ring: ring(), evaluation: { calitati: ['x'] } },
    { kind: 'own', ring: ring(), pedigreeText: 'x'.repeat(2001) },
    { kind: 'own', ring: ring(), name: 'n'.repeat(81) },
    { kind: 'own', ring: 'R'.repeat(81) },
    { kind: 'own', ring: ring(), name: 'cu\u0000nul' },
  ];
  const before = await count(a);
  for (const body of bodies) clientError(await create(a, body), JSON.stringify(body).slice(0, 120));
  assert.equal(await count(a), before, 'nimic salvat din cererile greșite');
  // Corp care nu e obiect: listă, text, număr, null.
  for (const raw of ['[]', '"text"', '5', 'null', '{"kind":', '{"a":1}}']) {
    const r = await call('/api/pigeons', { method: 'POST', cookie: a, raw, headers: { 'Content-Type': 'application/json' } });
    clientError(r, `corp ${raw}`);
  }
  // Fără Content-Type JSON.
  const r = await call('/api/pigeons', { method: 'POST', cookie: a, raw: 'kind=own', headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
  assert.equal(r.status, 415);
});

test('PATCH cu tipuri greșite: 4xx și fișa rămâne neschimbată', async () => {
  const p = (await create(a, { kind: 'own', ring: ring(), name: 'Original' })).data.pigeon;
  for (const body of [{ name: 1 }, { ring: [] }, { kind: 'altceva' }, { lines: {} }, { evaluation: 5 }, { hatchedOn: '2025-13-01' }]) {
    clientError(await call(`/api/pigeons/${p.id}`, { method: 'PATCH', cookie: a, body }), JSON.stringify(body));
  }
  const now = (await call(`/api/pigeons/${p.id}`, { cookie: a })).data.pigeon;
  assert.equal(now.name, 'Original');
  assert.equal(now.ring.raw, p.ring.raw);
});

test('texte uriașe: corp peste 1 MB → 413 cu mesaj; nume de 500 KB → 400', async () => {
  const big = await create(a, { kind: 'own', ring: ring(), name: 'x'.repeat(1_100_000) });
  assert.equal(big.status, 413);
  assert.match(big.data.error, /prea mare/);
  const mid = await create(a, { kind: 'own', ring: ring(), name: 'x'.repeat(500_000) });
  assert.equal(mid.status, 400);
  assert.match(mid.data.error, /depășește/);
});

test('o listă lungă de „linii” (3000) e refuzată repede, fără să blocheze serverul pentru ceilalți', async () => {
  const lines = Array.from({ length: 3000 }, (_, i) => `linia${i}`);
  const t0 = Date.now();
  const health = (async () => {
    await new Promise((r) => setTimeout(r, 50));
    const h0 = Date.now();
    await call('/api/health', { auth: 'none' });
    return Date.now() - h0;
  })();
  const r = await create(a, { kind: 'own', ring: ring(), lines });
  const took = Date.now() - t0;
  clientError(r, 'linii');
  const healthMs = await health;
  assert.ok(took < 1000, `validarea a durat ${took} ms (O(n²) cu fold în pigeons.js validLines)`);
  assert.ok(healthMs < 500, `/api/health a așteptat ${healthMs} ms: serverul a fost blocat pentru toți`);
});

test('unicode: emoji, RTL, zero-width în nume se păstrează exact; inel cu zero-width nu trece drept inel bun', async () => {
  const name = '🐦 Fulger ‮dreapta‬ زاجل ​ascuns ă î ș ț';
  const p = await create(a, { kind: 'own', ring: ring(), name, colorText: '🔵 vânăt' });
  assert.equal(p.status, 201, JSON.stringify(p.data));
  assert.equal(p.data.pigeon.name, name.trim());
  const found = await call(`/api/pigeons?q=${encodeURIComponent('fulger')}`, { cookie: a });
  assert.equal(found.status, 200);
  assert.ok(found.data.pigeons.some((x) => x.id === p.data.pigeon.id));
  for (const bad of ['RO-25-12​3456', 'RO-25-١٢٣٤٥٦', 'RO-25-１２３４５６', '🐦-25-123456']) {
    const r = await create(a, { kind: 'own', ring: bad });
    assert.equal(r.status, 400, bad);
    assert.match(r.data.error, /Inelul nu poate fi citit/);
  }
  // Ca strămoș extern, inelul ciudat se păstrează ca text.
  const ext = await create(a, { kind: 'external', ring: '🐦-25-123456' });
  assert.equal(ext.status, 201);
  assert.equal(ext.data.pigeon.ring.raw, '🐦-25-123456');
});

// ---------------------------------------------------------------- import de pedigree

test('import: forme greșite (listă, text, număr, listă de 10.000) → 400 cu mesaj', async () => {
  for (const root of [[], 'RO-25-1', 5, true, Array.from({ length: 10_000 }, () => ({ ring: 'RO-25-1' })), { ring: 'RO-25-777', father: 'tata' }, { ring: 'RO-25-777', mother: [1] }]) {
    clientError(await imp(a, root), JSON.stringify(root).slice(0, 80));
  }
  clientError(await imp(a, { ring: ring() }, { x: 1 }), 'rootKind obiect');
  clientError(await imp(a, { ring: ring() }, 'altceva'), 'rootKind text');
  clientError(await imp(a, null), 'root null');
  clientError(await imp(a, {}), 'root gol');
});

test('import: imbricare de 50.000 de niveluri → 400 repede (fără stack overflow)', async () => {
  let s = '{"ring":"RO-25-1"}';
  const depth = 50_000;
  s = '{"ring":"RO-25-9","father":'.repeat(depth) + s + '}'.repeat(depth);
  const t0 = Date.now();
  const r = await call('/api/pedigrees/import', { method: 'POST', cookie: a, raw: `{"root":${s}}`, headers: { 'Content-Type': 'application/json' } });
  assert.ok(r.status === 400 || r.status === 413, `${r.status} ${JSON.stringify(r.data)}`);
  assert.ok(Date.now() - t0 < 3000);
});

/** Arbore complet cu `gen` generații (gen = 5 → 31 de noduri). */
function fullTree(gen, prefix) {
  let k = 0;
  const build = (d, sex) => (d >= gen ? null : { ring: `RO-${prefix}-${++k}${sex ? ' ' + sex : ''}`, father: build(d + 1, 'M'), mother: build(d + 1, 'F') });
  return build(0, null);
}

test('import: 31 de căsuțe intră; 6 generații (63) → 400 și nimic salvat', async () => {
  const c = await newAccount(call, 'Arbore');
  const ok = await imp(c, fullTree(5, '21'));
  assert.equal(ok.status, 201, JSON.stringify(ok.data));
  assert.equal(ok.data.created, 31);
  const r = await imp(c, fullTree(6, '22'));
  assert.equal(r.status, 400);
  assert.match(r.data.error, /cel mult 5 generații/);
  assert.equal(await count(c), 31);
});

test('import: porumbelul e propriul tată → 400, nimic rămas pe jumătate', async () => {
  const c = await newAccount(call, 'Ciclu');
  const r = await imp(c, node('RO-25-500', node('RO-25-500 M')));
  assert.equal(r.status, 400, JSON.stringify(r.data));
  assert.match(r.data.error, /strămoș al lui însuși/);
  assert.equal(await count(c), 0);
});

test('import: același inel reapare în propria ascendență la adâncimi diferite → 400 și rollback complet', async () => {
  const c = await newAccount(call, 'Ciclu2');
  // R → tatăl X → mama Y → tatăl R (R e străbunicul lui însuși); plus o ramură normală.
  const root = node('RO-25-600', node('RO-25-601 M', node('RO-25-603 M'), node('RO-25-602 F', node('RO-25-600 M'))), node('RO-25-604 F'));
  const r = await imp(c, root);
  assert.equal(r.status, 400, JSON.stringify(r.data));
  assert.equal(await count(c), 0);
  // Inelul repetat la adâncimi diferite fără ciclu (același străbunic pe ambele părți) e legitim.
  const ok = await imp(c, node('RO-25-610', node('RO-25-611 M', node('RO-25-699 M')), node('RO-25-612 F', node('RO-25-699 M'))));
  assert.equal(ok.status, 201, JSON.stringify(ok.data));
  assert.equal(ok.data.created, 4);
});

test('import: același porumbel ca tată și ca mamă → mama nu se leagă, apare în conflicte', async () => {
  const c = await newAccount(call, 'TataMama');
  const r = await imp(c, node('RO-25-700', node('RO-25-701'), node('RO-25-701')));
  assert.equal(r.status, 201, JSON.stringify(r.data));
  const p = (await call(`/api/pigeons/${r.data.pigeonId}`, { cookie: c })).data.pigeon;
  assert.notEqual(p.fatherId, null);
  assert.equal(p.motherId, null);
  assert.equal(r.data.conflicts.length, 1);
});

test('import dublu-clic (aceeași cerere de două ori la rând): a doua refolosește tot, fără dubluri', async () => {
  const c = await newAccount(call, 'Dublu');
  const one = await imp(c, PEDIGREE_FOTO);
  const two = await imp(c, PEDIGREE_FOTO);
  assert.equal(one.status, 201);
  assert.equal(two.status, 201);
  assert.equal(two.data.pigeonId, one.data.pigeonId);
  assert.equal(two.data.created, 0);
  assert.equal(await count(c), one.data.created);
});

// ---------------------------------------------------------------- consola: credit și abonament

test('credit: sume aberante (negativ uriaș, NaN, Infinity, 1e308, text, null, 0) → 400 cu mesaj', async () => {
  const id = (await meOf(a)).id;
  for (const amount of [Number.NaN, 'Infinity', '-Infinity', 1e308, -1e308, 1001, -1001, 'cinci', null, 0, '', {}, [1, 2]]) {
    const r = await call(`/api/admin/accounts/${id}/credit`, { method: 'POST', cookie: admin, body: { amount } });
    assert.equal(r.status, 400, `${JSON.stringify(amount)}: ${r.status}`);
    assert.match(r.data.error, /dolari/);
  }
  assert.equal((await meOf(a)).aiCredit, 0);
});

test('credit: o sumă care nu e număr (true, [5], "0x10") e refuzată, nu socotită 1 $ / 5 $ / 16 $', async () => {
  const c = await newAccount(call, 'CreditTip');
  const id = (await meOf(c)).id;
  for (const amount of [true, [5], '0x10']) {
    const r = await call(`/api/admin/accounts/${id}/credit`, { method: 'POST', cookie: admin, body: { amount } });
    assert.equal(r.status, 400, `${JSON.stringify(amount)} a fost acceptat: credit acum ${(await meOf(c)).aiCredit} $`);
  }
});

test('credit: corectura negativă mai mare decât creditul — istoricul arată ce s-a scăzut de fapt', async () => {
  const c = await newAccount(call, 'Corectura');
  const id = (await meOf(c)).id;
  await call(`/api/admin/accounts/${id}/credit`, { method: 'POST', cookie: admin, body: { amount: 2 } });
  const r = await call(`/api/admin/accounts/${id}/credit`, { method: 'POST', cookie: admin, body: { amount: -10 } });
  assert.ok(r.status === 200 || r.status === 400);
  const d = (await call(`/api/admin/accounts/${id}`, { cookie: admin })).data;
  const sum = d.events.filter((e) => e.kind === 'credit').reduce((s, e) => s + e.amount, 0);
  assert.equal(d.account.aiCredit, 0);
  assert.equal(sum, d.account.aiCredit, `istoricul adună ${sum} $, dar creditul e ${d.account.aiCredit} $ (logEvent scrie -10, se scad doar 2)`);
});

test('abonament: date imposibile (30 februarie, anul 99999, 0000) → 400 cu mesaj despre dată, abonamentul neschimbat', async () => {
  const c = await newAccount(call, 'Date');
  const id = (await meOf(c)).id;
  const before = (await meOf(c)).subscription;
  for (const body of [{ start: '99999-01-01' }, { start: '2026-13-01' }, { start: 20260101 }, { start: '2026-01-01', end: '2025-01-01' }]) {
    clientError(await call(`/api/admin/accounts/${id}/subscription`, { method: 'POST', cookie: admin, body }), JSON.stringify(body));
  }
  for (const body of [{ start: '2026-02-30' }, { start: '2027-02-29' }, { start: '0000-01-01' }, { start: '2026-01-01', end: '2026-04-31' }]) {
    const r = await call(`/api/admin/accounts/${id}/subscription`, { method: 'POST', cookie: admin, body });
    assert.equal(r.status, 400, JSON.stringify(body));
    assert.match(r.data.error, /dat/i, `${JSON.stringify(body)} → „${r.data.error}” (mesajul generic al bazei, nu despre dată)`);
  }
  assert.deepEqual((await meOf(c)).subscription, before);
});

test('jurnal: date imposibile → 400; anul 0000 nu ajunge la baza de date ca „Valoare invalidă”', async () => {
  const p = (await create(a, { kind: 'own', ring: ring() })).data.pigeon;
  const post = (body) => call(`/api/pigeons/${p.id}/journal`, { method: 'POST', cookie: a, body });
  for (const date of ['2026-02-30', '99999-01-01', '2026-1-1', 20260101, null, ['2026-01-01']]) {
    const r = await post({ date, type: 'nota', text: 'x' });
    assert.equal(r.status, 400, JSON.stringify(date));
    assert.match(r.data.error, /Data/);
  }
  clientError(await post({ date: '2026-01-01', type: 'necunoscut', text: 'x' }), 'tip');
  clientError(await post({ date: '2026-01-01', type: 'nota', text: 'x'.repeat(4001) }), 'text lung');
  const zero = await post({ date: '0000-01-01', type: 'nota', text: 'x' });
  assert.equal(zero.status, 400);
  assert.match(zero.data.error, /Data/, `anul 0000: „${zero.data.error}”`);
});

// ---------------------------------------------------------------- familie

test('părinți: femelă ca tată, mascul ca mamă, același ca tată și mamă, propriul părinte → 400', async () => {
  const kid = (await create(a, { kind: 'own', ring: ring() })).data.pigeon;
  const f = (await create(a, { kind: 'own', ring: ring(), sex: 'F' })).data.pigeon;
  const m = (await create(a, { kind: 'own', ring: ring(), sex: 'M' })).data.pigeon;
  const u = (await create(a, { kind: 'external', ring: ring() })).data.pigeon;
  const put = (body) => call(`/api/pigeons/${kid.id}/parents`, { method: 'PUT', cookie: a, body });
  assert.match((await put({ fatherId: f.id })).data.error, /mascul/);
  assert.match((await put({ motherId: m.id })).data.error, /femelă/);
  assert.match((await put({ fatherId: u.id, motherId: u.id })).data.error, /același/);
  assert.match((await put({ fatherId: kid.id })).data.error, /propriul părinte/);
  for (const fatherId of [-1, 0.5, 'abc', {}, 9007199254740993]) clientError(await put({ fatherId }), JSON.stringify(fatherId));
  assert.equal((await put({ fatherId: 999999999 })).status, 404);
});

test('un mascul deja tată nu poate fi schimbat în femelă (altfel puii au „tată” femelă)', async () => {
  const kid = (await create(a, { kind: 'own', ring: ring() })).data.pigeon;
  const dad = (await create(a, { kind: 'own', ring: ring(), sex: 'M' })).data.pigeon;
  assert.equal((await call(`/api/pigeons/${kid.id}/parents`, { method: 'PUT', cookie: a, body: { fatherId: dad.id } })).status, 200);
  const r = await call(`/api/pigeons/${dad.id}`, { method: 'PATCH', cookie: a, body: { sex: 'F' } });
  const nowDad = (await call(`/api/pigeons/${dad.id}`, { cookie: a })).data.pigeon;
  assert.equal(r.status, 400, `PATCH sex F pe tată: ${r.status}; acum sex=${nowDad.sex}, tatăl puiului ${kid.id} e femelă`);
});

test('ștergere: cu pui → 409; cu link public → linkul moare; în vânzare în așteptare → cumpărătorul primește 404 clar', async () => {
  const dad = (await create(a, { kind: 'own', ring: ring(), sex: 'M' })).data.pigeon;
  const kid = (await create(a, { kind: 'own', ring: ring() })).data.pigeon;
  await call(`/api/pigeons/${kid.id}/parents`, { method: 'PUT', cookie: a, body: { fatherId: dad.id } });
  const d = await call(`/api/pigeons/${dad.id}`, { method: 'DELETE', cookie: a });
  assert.equal(d.status, 409);
  assert.match(d.data.error, /pui/);

  const pub = (await create(a, { kind: 'own', ring: ring() })).data.pigeon;
  const url = (await call(`/api/pigeons/${pub.id}/public`, { method: 'POST', cookie: a })).data.url;
  assert.equal((await call(`/api/pigeons/${pub.id}`, { method: 'DELETE', cookie: a })).status, 204);
  const gone = await call(`/api/public/${url.split('/p/')[1]}`, { auth: 'none' });
  assert.equal(gone.status, 404);
  assert.match(gone.data.error, /Linkul nu mai este valabil/);

  const buyer = await newAccount(call, 'Cumpărător');
  const sold = (await create(a, { kind: 'own', ring: ring() })).data.pigeon;
  const t = await call(`/api/pigeons/${sold.id}/transfers`, { method: 'POST', cookie: a, body: { email: await emailOf(buyer) } });
  assert.equal(t.status, 201);
  assert.equal((await call(`/api/pigeons/${sold.id}`, { method: 'DELETE', cookie: a })).status, 204);
  assert.equal((await call('/api/transfers', { cookie: buyer })).data.incoming.length, 0);
  const acc = await call(`/api/transfers/${t.data.transfer.id}/accept`, { method: 'POST', cookie: buyer });
  assert.equal(acc.status, 404);
  assert.match(acc.data.error, /Vânzarea nu a fost găsită/);
});

// ---------------------------------------------------------------- vânzări și link public

test('vânzări aberante: extern, către sine, email-obiect, cumpărătorul acceptă ce a fost anulat, vânzătorul își acceptă vânzarea', async () => {
  const buyer = await newAccount(call, 'Cumpărător');
  const ext = (await create(a, { kind: 'external', ring: ring() })).data.pigeon;
  const sell = (id, body) => call(`/api/pigeons/${id}/transfers`, { method: 'POST', cookie: a, body });
  assert.match((await sell(ext.id, { email: await emailOf(buyer) })).data.error, /doar porumbei din porumbarul tău/);
  const own = (await create(a, { kind: 'own', ring: ring() })).data.pigeon;
  assert.equal((await sell(own.id, { email: await emailOf(a) })).status, 400);
  clientError(await sell(own.id, { email: { $ne: '' } }), 'email obiect');
  clientError(await sell(own.id, { email: ['x@y.z'] }), 'email listă');
  clientError(await sell(own.id, {}), 'fără email');
  const t = (await sell(own.id, { email: await emailOf(buyer) })).data.transfer;
  assert.equal((await call(`/api/transfers/${t.id}/accept`, { method: 'POST', cookie: a })).status, 404); // vânzătorul nu e cumpărătorul
  assert.equal((await call(`/api/transfers/${t.id}/cancel`, { method: 'POST', cookie: buyer })).status, 200);
  const late = await call(`/api/transfers/${t.id}/accept`, { method: 'POST', cookie: buyer });
  assert.equal(late.status, 409);
  assert.match(late.data.error, /anulată/);
  assert.equal((await call(`/api/transfers/${t.id}/cancel`, { method: 'POST', cookie: a })).status, 409);
  // dublu-clic pe „Primesc”
  const t2 = (await sell(own.id, { email: await emailOf(buyer) })).data.transfer;
  assert.equal((await call(`/api/transfers/${t2.id}/accept`, { method: 'POST', cookie: buyer })).status, 200);
  const again = await call(`/api/transfers/${t2.id}/accept`, { method: 'POST', cookie: buyer });
  assert.equal(again.status, 409);
  assert.match(again.data.error, /deja primită/);
});

test('vânzare cu includePrivate: "false" (text) nu dă cumpărătorului notele și jurnalul', async () => {
  const s = await newAccount(call, 'Vânzător');
  const buyer = await newAccount(call, 'Cumpărător');
  const p = (await create(s, { kind: 'own', ring: ring(), evaluation: { calitati: 'secretul vânzătorului' } })).data.pigeon;
  await call(`/api/pigeons/${p.id}/journal`, { method: 'POST', cookie: s, body: { date: '2026-01-01', type: 'nota', text: 'jurnal privat' } });
  const t = (await call(`/api/pigeons/${p.id}/transfers`, { method: 'POST', cookie: s, body: { email: await emailOf(buyer), includePrivate: 'false' } })).data.transfer;
  const ok = await call(`/api/transfers/${t.id}/accept`, { method: 'POST', cookie: buyer });
  const mine = (await call(`/api/pigeons/${ok.data.pigeonId}`, { cookie: buyer })).data.pigeon;
  assert.equal(mine.evaluation.calitati ?? null, null, 'notele private au ajuns la cumpărător (Boolean("false") === true)');
});

test('„Ce apare pe pedigree”: showEmail: "false" (text) nu publică emailul', async () => {
  const c = await newAccount(call, 'Ascuns');
  await call('/api/auth/me', { method: 'PATCH', cookie: c, body: { showEmail: 'false', showPhone: 'false' } });
  const me = await meOf(c);
  assert.equal(me.showEmail, false, 'emailul a devenit public (Boolean("false") === true)');
});

test('linkul public: preluarea propriului link → 400; token aberant → 404; extern nu poate avea link', async () => {
  const p = (await create(a, { kind: 'own', ring: ring() })).data.pigeon;
  const url = (await call(`/api/pigeons/${p.id}/public`, { method: 'POST', cookie: a })).data.url;
  const own = await call(`/api/public/${url.split('/p/')[1]}/import`, { method: 'POST', cookie: a, body: {} });
  assert.equal(own.status, 400);
  assert.match(own.data.error, /deja în porumbarul tău/);
  for (const tok of ['x', 'a'.repeat(65), "'; DROP TABLE pigeons;--", '%00', '..%2F..%2Fetc', 'A'.repeat(5000)]) {
    const r = await call(`/api/public/${tok}`, { auth: 'none' });
    assert.equal(r.status, 404, tok.slice(0, 20));
  }
  const ext = (await create(a, { kind: 'external', ring: ring() })).data.pigeon;
  assert.equal((await call(`/api/pigeons/${ext.id}/public`, { method: 'POST', cookie: a })).status, 400);
});

// ---------------------------------------------------------------- id-uri, query

test('id-uri ciudate (0, -1, 2^53+1, 1e3, 01, abc, 1.5, Infinity) → 404/400, niciodată 500', async () => {
  const ids = ['0', '-1', '9007199254740993', '1e3', '1.5', 'abc', 'Infinity', '1e400', '%20', '999999999999999999999'];
  const paths = (id) => [
    `/api/pigeons/${id}`,
    `/api/pigeons/${id}/tree`,
    `/api/pigeons/${id}/family`,
    `/api/pigeons/${id}/coi`,
    `/api/pigeons/${id}/bloodlines`,
    `/api/pigeons/${id}/journal`,
    `/api/pigeons/${id}/pedigree`,
    `/api/network?rootId=${id}`,
    `/api/pairs/coi?sireId=${id}&damId=${id}`,
  ];
  for (const id of ids) {
    for (const p of paths(id)) {
      const r = await call(p, { cookie: a });
      assert.ok([400, 404].includes(r.status), `${p}: ${r.status} ${JSON.stringify(r.data)}`);
    }
    for (const [p, method] of [[`/api/transfers/${id}/accept`, 'POST'], [`/api/transfers/${id}/cancel`, 'POST'], [`/api/journal/${id}`, 'DELETE'], [`/api/pigeons/${id}`, 'DELETE']]) {
      const r = await call(p, { method, cookie: a });
      assert.ok([400, 404].includes(r.status), `${method} ${p}: ${r.status}`);
    }
    const adm = await call(`/api/admin/accounts/${id}`, { cookie: admin });
    assert.ok([400, 404].includes(adm.status), `admin ${id}: ${adm.status}`);
  }
});

test('query aberant: q de 10.000 de caractere, % și _, filtre ca liste, an uriaș, generații în afara limitelor', async () => {
  assert.equal((await call(`/api/pigeons?q=${'ab%_\\'.repeat(2000)}`, { cookie: a })).status, 200);
  assert.equal((await call('/api/pigeons?q=%25', { cookie: a })).data.pigeons.length, 0);
  clientError(await call('/api/pigeons?status=a&status=b', { cookie: a }), 'status listă');
  clientError(await call('/api/pigeons?sex=X', { cookie: a }), 'sex');
  clientError(await call('/api/pigeons?year=abc', { cookie: a }), 'an text');
  clientError(await call('/api/pigeons?year=99999999999', { cookie: a }), 'an uriaș');
  const p = (await create(a, { kind: 'own', ring: ring() })).data.pigeon;
  for (const g of ['0', '11', '-1', '1.5', 'abc', '1e9']) clientError(await call(`/api/pigeons/${p.id}/tree?generations=${g}`, { cookie: a }), `generații ${g}`);
  for (const q of ['up=0', 'up=11', 'down=-1', 'down=abc']) clientError(await call(`/api/network?${q}`, { cookie: a }), q);
  const huge = await call(`/api/pigeons?q=${'x'.repeat(40_000)}`, { cookie: a });
  assert.ok(huge.status === 431 || huge.status === 414 || huge.status === 200, `URL de 40 KB: ${huge.status}`);
});

test('pozele: date care nu sunt base64 (obiect, număr) sunt refuzate fără să cheme modelul și fără cost', async () => {
  const c = await newAccount(call, 'Poza');
  const id = (await meOf(c)).id;
  await call(`/api/admin/accounts/${id}/credit`, { method: 'POST', cookie: admin, body: { amount: 1 } });
  const reader = await import('../src/pedigree-reader.js');
  let calls = 0;
  reader.setPedigreeModel(async () => {
    calls++;
    return { slots: [{ slot: 1, ring: 'RO-25-1', name: null, color: null, text: null, breeder: null }], rootSex: null, notes: '', usage: { input_tokens: 1000, output_tokens: 0 } };
  });
  try {
    for (const data of [{ a: 1 }, 12345, ['AAAA'], true]) {
      const r = await call('/api/pedigrees/read', { method: 'POST', cookie: c, body: { mime: 'image/png', data } });
      assert.equal(r.status, 400, `data=${JSON.stringify(data)} → ${r.status}`);
    }
    assert.equal(calls, 0, `modelul a fost chemat de ${calls} ori cu gunoi (String(obiect) decodat ca base64)`);
  } finally {
    reader.setPedigreeModel(null);
  }
});
