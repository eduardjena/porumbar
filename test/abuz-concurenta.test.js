// Utilizatori simultani (stres): aceleași acțiuni trimise deodată (Promise.all). Așteptat: niciun 500, nicio dată
// dublată, pierdută sau contradictorie. Testele care pică arată un defect real (numele lor spune comportamentul corect).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { apiCaller } from './helpers/api.js';
import { startTestApp } from './helpers/db.js';
import { adminCookie, newAccount, today } from './helpers/accounts.js';
import { PEDIGREE_FOTO } from './fixtures/pedigree-foto.js';

let server;
let base;
let admin;
let reader;
const call = apiCaller(() => ({ base }));
before(async () => {
  ({ server, base } = await startTestApp());
  admin = await adminCookie(call);
  reader = await import('../src/pedigree-reader.js');
});
after(() => {
  reader?.setPedigreeModel(null);
  server?.close();
});

let seq = 200000;
const ring = (sex = '') => `RO-24-${++seq}${sex ? ' ' + sex : ''}`;
const meOf = async (cookie) => (await call('/api/auth/me', { cookie })).data.account;
const emailOf = async (cookie) => (await meOf(cookie)).email;
const create = (cookie, body) => call('/api/pigeons', { method: 'POST', cookie, body });
const imp = (cookie, root, rootKind) => call('/api/pedigrees/import', { method: 'POST', cookie, body: { root, rootKind } });
const list = async (cookie) => (await call('/api/pigeons', { cookie })).data.pigeons;
const statuses = (rs) => rs.map((r) => r.status).sort().join(',');
const no500 = (rs, what) => {
  const bad = rs.filter((r) => r.status >= 500);
  assert.equal(bad.length, 0, `${what}: ${bad.map((r) => `${r.status} ${JSON.stringify(r.data)}`).join(' | ')}`);
};
const n = (r, father = null, mother = null) => ({ ring: r, father, mother });

/** Arbore complet cu 5 generații (31 de inele noi). */
function fullTree(gen = 5) {
  const build = (d, sex) => (d >= gen ? null : { ring: ring(sex), father: build(d + 1, 'M'), mother: build(d + 1, 'F') });
  return build(0, null);
}

// ---------------------------------------------------------------- vânzări

test('două „Primesc” deodată pe aceeași vânzare: una reușește, cealaltă 409; o singură copie', async () => {
  const s = await newAccount(call, 'Vânzător');
  const b = await newAccount(call, 'Cumpărător');
  const seeded = (await imp(s, PEDIGREE_FOTO)).data; // 31 de căsuțe, 27 de inele diferite
  const id = seeded.pigeonId;
  const t = (await call(`/api/pigeons/${id}/transfers`, { method: 'POST', cookie: s, body: { email: await emailOf(b) } })).data.transfer;
  const rs = await Promise.all(Array.from({ length: 5 }, () => call(`/api/transfers/${t.id}/accept`, { method: 'POST', cookie: b })));
  no500(rs, 'accept x5');
  assert.equal(statuses(rs), '200,409,409,409,409');
  const mine = await list(b);
  assert.equal(mine.filter((p) => p.ring?.display === 'RO-15-412084').length, 1);
  assert.equal(mine.length, seeded.created);
});

test('vânzarea pusă de două ori deodată: o singură vânzare în așteptare', async () => {
  const s = await newAccount(call, 'Vânzător');
  const b = await newAccount(call, 'Cumpărător');
  const p = (await create(s, { kind: 'own', ring: ring() })).data.pigeon;
  const email = await emailOf(b);
  const rs = await Promise.all(Array.from({ length: 10 }, () => call(`/api/pigeons/${p.id}/transfers`, { method: 'POST', cookie: s, body: { email } })));
  no500(rs, 'vânzare x10');
  assert.equal(rs.filter((r) => r.status === 201).length, 1);
  assert.equal((await call('/api/transfers', { cookie: b })).data.incoming.length, 1);
});

test('„Primesc” și „Anulează” în același moment: vânzarea primită nu ajunge „anulată” (și nu se poate vinde din nou)', async () => {
  const problems = [];
  for (let round = 0; round < 4; round++) {
    const s = await newAccount(call, 'Vânzător');
    const b = await newAccount(call, 'Cumpărător');
    const id = (await imp(s, fullTree())).data.pigeonId;
    const t = (await call(`/api/pigeons/${id}/transfers`, { method: 'POST', cookie: s, body: { email: await emailOf(b) } })).data.transfer;
    const accept = call(`/api/transfers/${t.id}/accept`, { method: 'POST', cookie: b });
    await new Promise((r) => setTimeout(r, 30)); // cumpărătorul apasă primul, vânzătorul o clipă mai târziu
    const cancel = call(`/api/transfers/${t.id}/cancel`, { method: 'POST', cookie: s });
    const [ra, rc] = await Promise.all([accept, cancel]);
    no500([ra, rc], 'accept/cancel');
    const out = (await call('/api/transfers', { cookie: s })).data.outgoing.find((x) => x.id === t.id);
    if (ra.status === 200 && rc.status === 200) problems.push(`runda ${round}: ambele 200, vânzarea e „${out.status}”, cumpărătorul are porumbelul ${ra.data.pigeonId}`);
    else if (ra.status === 200 && out.status !== 'accepted') problems.push(`runda ${round}: primită, dar vânzarea e „${out.status}”`);
    if (ra.status === 200) {
      const b2 = await newAccount(call, 'AlDoilea');
      const again = await call(`/api/pigeons/${id}/transfers`, { method: 'POST', cookie: s, body: { email: await emailOf(b2) } });
      if (again.status === 201) problems.push(`runda ${round}: porumbelul deja primit se poate vinde din nou (201)`);
    }
  }
  assert.deepEqual(problems, []);
});

test('vânzătorul șterge porumbelul exact când cumpărătorul apasă „Primesc”: fără 500', async () => {
  const all = [];
  for (let round = 0; round < 4; round++) {
    const s = await newAccount(call, 'Vânzător');
    const b = await newAccount(call, 'Cumpărător');
    const id = (await imp(s, n(ring()))).data.pigeonId;
    const t = (await call(`/api/pigeons/${id}/transfers`, { method: 'POST', cookie: s, body: { email: await emailOf(b) } })).data.transfer;
    all.push(...(await Promise.all([call(`/api/transfers/${t.id}/accept`, { method: 'POST', cookie: b }), call(`/api/pigeons/${id}`, { method: 'DELETE', cookie: s })])));
  }
  no500(all, 'accept/ștergere');
});

// ---------------------------------------------------------------- import de pedigree

test('același pedigree importat de 10 ori deodată în același cont: fără dubluri, fără 500', async () => {
  const c = await newAccount(call, 'Paralel');
  const rs = await Promise.all(Array.from({ length: 10 }, () => imp(c, PEDIGREE_FOTO)));
  no500(rs, 'import x10');
  const ok = rs.filter((r) => r.status === 201);
  assert.ok(ok.length >= 1);
  assert.equal(new Set(ok.map((r) => r.data.pigeonId)).size, 1);
  assert.equal((await list(c)).length, ok[0].data.created, 'fiecare inel o singură dată');
});

test('același pedigree importat de 10 ori deodată (dublu-clic pe „Salvează”): toate reușesc, ca la rând', async () => {
  const c = await newAccount(call, 'Paralel2');
  const rs = await Promise.all(Array.from({ length: 10 }, () => imp(c, PEDIGREE_FOTO)));
  const failed = rs.filter((r) => r.status !== 201);
  assert.equal(failed.length, 0, `${failed.length}/10 au primit ${[...new Set(failed.map((r) => `${r.status} „${r.data?.error}”`))].join('; ')}`);
});

test('două pedigree-uri diferite cu strămoși comuni, în ordine încrucișată, importate deodată: fără 500 (deadlock)', async () => {
  const rs = [];
  for (let round = 0; round < 12; round++) {
    const c = await newAccount(call, 'Cruce');
    // P1 trece întâi pe A, apoi pe B; P2 întâi pe B, apoi pe A (aceleași inele noi, inserate în ordine opusă).
    const A = [ring('M'), ring('M'), ring('M')];
    const B = [ring('F'), ring('F'), ring('F')];
    const p1 = n(ring(), n(A[0], n(A[1]), n(B[1])), n(B[0], n(A[2]), n(B[2])));
    const p2 = n(ring(), n(ring('M'), null, n(B[0], n(A[2]), n(B[2]))), n(ring('F'), n(A[0], n(A[1]), n(B[1]))));
    rs.push(...(await Promise.all([imp(c, p1), imp(c, p2)])));
  }
  no500(rs, 'import încrucișat');
  const lost = rs.filter((r) => r.status !== 201);
  assert.equal(lost.length, 0, `${lost.length}/${rs.length} importuri refuzate: ${[...new Set(lost.map((r) => `${r.status} „${r.data?.error}”`))].join('; ')}`);
});

test('același inel ca porumbel propriu, creat de 10 ori deodată: unul singur, restul 409 cu mesaj', async () => {
  const c = await newAccount(call, 'Inel');
  const r0 = ring();
  const rs = await Promise.all(Array.from({ length: 10 }, () => create(c, { kind: 'own', ring: r0 })));
  no500(rs, 'creare x10');
  assert.equal(rs.filter((r) => r.status === 201).length, 1);
  for (const r of rs.filter((x) => x.status !== 201)) {
    assert.equal(r.status, 409);
    assert.equal(typeof r.data.error, 'string');
  }
  assert.equal((await list(c)).length, 1);
});

// ---------------------------------------------------------------- familie

test('A tată lui B și B tată lui A, trimise deodată: nu se creează un ciclu', async () => {
  const cycles = [];
  const c = await newAccount(call, 'CicluParalel');
  for (let round = 0; round < 6; round++) {
    const x = (await create(c, { kind: 'own', ring: ring(), sex: 'M' })).data.pigeon;
    const y = (await create(c, { kind: 'own', ring: ring(), sex: 'M' })).data.pigeon;
    const rs = await Promise.all([
      call(`/api/pigeons/${x.id}/parents`, { method: 'PUT', cookie: c, body: { fatherId: y.id } }),
      call(`/api/pigeons/${y.id}/parents`, { method: 'PUT', cookie: c, body: { fatherId: x.id } }),
    ]);
    no500(rs, 'părinți încrucișați');
    const fx = (await call(`/api/pigeons/${x.id}`, { cookie: c })).data.pigeon.fatherId;
    const fy = (await call(`/api/pigeons/${y.id}`, { cookie: c })).data.pigeon.fatherId;
    if (fx === y.id && fy === x.id) cycles.push(`runda ${round}: ${x.id} ↔ ${y.id} (${statuses(rs)})`);
  }
  assert.deepEqual(cycles, []);
});

test('tatăl e șters exact când e ales ca tată: fără 500 și fără pui rămas cu tatăl șters în tăcere', async () => {
  const c = await newAccount(call, 'StergeTata');
  const problems = [];
  const rs = [];
  for (let round = 0; round < 10; round++) {
    const kid = (await create(c, { kind: 'own', ring: ring() })).data.pigeon;
    const dad = (await create(c, { kind: 'own', ring: ring(), sex: 'M' })).data.pigeon;
    const [put, del] = await Promise.all([
      call(`/api/pigeons/${kid.id}/parents`, { method: 'PUT', cookie: c, body: { fatherId: dad.id } }),
      call(`/api/pigeons/${dad.id}`, { method: 'DELETE', cookie: c }),
    ]);
    rs.push(put, del);
    if (put.status === 200 && del.status === 204) problems.push(`runda ${round}: tatăl salvat (200) și apoi șters (204) — puiul a rămas fără tată`);
  }
  no500(rs, 'părinte/ștergere');
  assert.deepEqual(problems, []);
});

test('mulți citesc arborele / liniile / rețeaua / COI cât altcineva schimbă părinții: toate citirile 200', async () => {
  const c = await newAccount(call, 'Cititori');
  const root = (await imp(c, PEDIGREE_FOTO)).data.pigeonId;
  const males = [];
  const females = [];
  for (let i = 0; i < 4; i++) {
    males.push((await create(c, { kind: 'own', ring: ring(), sex: 'M' })).data.pigeon.id);
    females.push((await create(c, { kind: 'own', ring: ring(), sex: 'F' })).data.pigeon.id);
  }
  const kids = [];
  for (let i = 0; i < 5; i++) kids.push((await create(c, { kind: 'own', ring: ring() })).data.pigeon.id);
  const writes = Array.from({ length: 20 }, (_, i) =>
    call(`/api/pigeons/${kids[i % kids.length]}/parents`, { method: 'PUT', cookie: c, body: { fatherId: males[i % 4], motherId: females[(i + 1) % 4] } }),
  );
  const paths = [`/api/pigeons/${root}/tree?generations=10`, `/api/pigeons/${root}/bloodlines`, '/api/network', `/api/network?rootId=${root}&up=10&down=10`, `/api/pigeons/${root}/coi`, `/api/pigeons/${root}/family`, `/api/pigeons/${root}/pedigree`, '/api/board', `/api/pairs/coi?sireId=${males[0]}&damId=${females[0]}`];
  const reads = Array.from({ length: 45 }, (_, i) => call(paths[i % paths.length], { cookie: c }));
  const rw = await Promise.all(writes);
  const rr = await Promise.all(reads);
  no500([...rw, ...rr], 'citiri/scrieri');
  assert.deepEqual([...new Set(rr.map((r) => r.status))], [200]);
  assert.deepEqual([...new Set(rw.map((r) => r.status))], [200]);
});

// ---------------------------------------------------------------- link public

test('„Pornește linkul public” apăsat de 10 ori deodată: toate răspunsurile dau același link, care merge', async () => {
  const c = await newAccount(call, 'Link');
  const p = (await create(c, { kind: 'own', ring: ring() })).data.pigeon;
  const rs = await Promise.all(Array.from({ length: 10 }, () => call(`/api/pigeons/${p.id}/public`, { method: 'POST', cookie: c })));
  no500(rs, 'link x10');
  const urls = [...new Set(rs.map((r) => r.data.url))];
  const current = (await call(`/api/pigeons/${p.id}/public`, { cookie: c })).data.url;
  const dead = urls.filter((u) => u !== current);
  assert.equal(dead.length, 0, `${urls.length} linkuri diferite primite; ${dead.length} nu mai merg (fiecare cerere a scris alt token)`);
});

test('pornește / înlocuiește / oprește linkul deodată: la final linkul arătat e fie niciunul, fie unul care merge', async () => {
  const c = await newAccount(call, 'Link2');
  const p = (await create(c, { kind: 'own', ring: ring() })).data.pigeon;
  const ops = Array.from({ length: 15 }, (_, i) =>
    i % 3 === 0
      ? call(`/api/pigeons/${p.id}/public`, { method: 'POST', cookie: c })
      : i % 3 === 1
        ? call(`/api/pigeons/${p.id}/public/new`, { method: 'POST', cookie: c })
        : call(`/api/pigeons/${p.id}/public`, { method: 'DELETE', cookie: c }),
  );
  no500(await Promise.all(ops), 'link mix');
  const url = (await call(`/api/pigeons/${p.id}/public`, { cookie: c })).data.url;
  if (url) assert.equal((await call(`/api/public/${url.split('/p/')[1]}`, { auth: 'none' })).status, 200);
});

// ---------------------------------------------------------------- credit, limită, abonament, conturi

const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
/** Model fals: răspunde după `ms`, cu un cost de `micros` (4 µ$ pe jeton de intrare). */
const slowModel = (ms, micros) => async () => {
  await new Promise((r) => setTimeout(r, ms));
  return { slots: [{ slot: 1, ring: 'RO-25-1', name: null, color: null, text: null, breeder: null }], rootSex: null, notes: '', usage: { input_tokens: micros / 4, output_tokens: 0 } };
};
const readPhoto = (cookie) => call('/api/pedigrees/read', { method: 'POST', cookie, body: { mime: 'image/png', data: PNG } });

test('6 citiri de poze deodată cu credit pentru una singură: nu trec toate', async () => {
  const c = await newAccount(call, 'Credit');
  const id = (await meOf(c)).id;
  await call(`/api/admin/accounts/${id}/credit`, { method: 'POST', cookie: admin, body: { amount: 0.04 } });
  reader.setPedigreeModel(slowModel(300, 40_000)); // fiecare citire costă 0,04 $
  try {
    const rs = await Promise.all(Array.from({ length: 6 }, () => readPhoto(c)));
    no500(rs, 'citiri');
    const ok = rs.filter((r) => r.status === 200).length;
    const d = (await call(`/api/admin/accounts/${id}`, { cookie: admin })).data.account;
    assert.ok(ok <= 1, `${ok} citiri reușite (cost ${(ok * 0.04).toFixed(2)} $) cu un credit de 0,04 $; creditul acum ${d.aiCredit} $`);
  } finally {
    reader.setPedigreeModel(null);
  }
});

test('limita de citiri pe zi (2) nu se depășește cu cereri deodată', async () => {
  const prev = process.env.PEDIGREE_READS_PER_DAY;
  process.env.PEDIGREE_READS_PER_DAY = '2';
  const c = await newAccount(call, 'Limita');
  const id = (await meOf(c)).id;
  await call(`/api/admin/accounts/${id}/credit`, { method: 'POST', cookie: admin, body: { amount: 100 } });
  reader.setPedigreeModel(slowModel(300, 4));
  try {
    const rs = await Promise.all(Array.from({ length: 6 }, () => readPhoto(c)));
    no500(rs, 'citiri');
    const ok = rs.filter((r) => r.status === 200).length;
    assert.ok(ok <= 2, `${ok} citiri reușite peste limita de 2 pe zi (${statuses(rs)})`);
  } finally {
    reader.setPedigreeModel(null);
    if (prev === undefined) delete process.env.PEDIGREE_READS_PER_DAY;
    else process.env.PEDIGREE_READS_PER_DAY = prev;
  }
});

test('20 de adăugări de credit deodată (+1 $): niciuna pierdută; istoricul are 20 de rânduri', async () => {
  const c = await newAccount(call, 'Plus');
  const id = (await meOf(c)).id;
  const rs = await Promise.all(Array.from({ length: 20 }, () => call(`/api/admin/accounts/${id}/credit`, { method: 'POST', cookie: admin, body: { amount: 1 } })));
  no500(rs, 'credit x20');
  const d = (await call(`/api/admin/accounts/${id}`, { cookie: admin })).data;
  assert.equal(d.account.aiCredit, 20);
  assert.equal(d.events.filter((e) => e.kind === 'credit').length, 20);
});

test('10 activări de abonament deodată, cu date diferite: început și sfârșit din aceeași cerere', async () => {
  const c = await newAccount(call, 'Abonament', { active: false });
  const id = (await meOf(c)).id;
  const starts = Array.from({ length: 10 }, (_, i) => `2026-0${(i % 9) + 1}-1${i % 10}`);
  const rs = await Promise.all(starts.map((start) => call(`/api/admin/accounts/${id}/subscription`, { method: 'POST', cookie: admin, body: { start } })));
  no500(rs, 'abonament x10');
  const a = (await call(`/api/admin/accounts/${id}`, { cookie: admin })).data;
  assert.ok(starts.includes(a.account.subscriptionStart));
  assert.equal(a.account.subscriptionEnd, `${Number(a.account.subscriptionStart.slice(0, 4)) + 1}${a.account.subscriptionStart.slice(4)}`);
  assert.equal(a.events.filter((e) => e.kind === 'subscription').length, 10);
  assert.equal(today().length, 10);
});

test('10 înregistrări deodată cu același email: un singur cont, restul 409 cu mesaj', async () => {
  const email = `dublu-${process.pid}@exemplu.test`;
  const rs = await Promise.all(
    Array.from({ length: 10 }, (_, i) => call('/api/auth/register', { method: 'POST', auth: 'none', body: { email: i % 2 ? email.toUpperCase() : email, password: 'parola-de-test-123', name: `Dublu ${i}` } })),
  );
  no500(rs, 'register x10');
  assert.equal(rs.filter((r) => r.status === 201).length, 1);
  for (const r of rs.filter((x) => x.status !== 201)) {
    assert.equal(r.status, 409);
    assert.equal(typeof r.data.error, 'string');
  }
  const accounts = (await call(`/api/admin/accounts?q=${encodeURIComponent(email)}`, { cookie: admin })).data.accounts;
  assert.equal(accounts.length, 1);
});
