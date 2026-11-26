// Probe de securitate (separarea conturilor, adminul unic, „doar citire”, CSRF, sesiuni, intrări ostile).
// Un test care TRECE arată o apărare care ține; un test care PICĂ arată o problemă reală (aserțiunea descrie
// comportamentul sigur). Totul local: bază temporară, server pe port liber, fără rețea în afară.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import zlib from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';
import { apiCaller } from './helpers/api.js';
import { startTestApp } from './helpers/db.js';
import { adminCookie, confirmAndEnter, newAccount } from './helpers/accounts.js';
import { PEDIGREE_FOTO } from './fixtures/pedigree-foto.js';

// Fără cheie: citirea din poză nu are cum să iasă în rețea.
delete process.env.ANTHROPIC_API_KEY;
// Un email de admin cu „k”, ca să se poată încerca și semnul Kelvin (U+212A), care la litere mici devine „k”.
process.env.ADMIN_EMAIL = 'kasa@porumbar.test';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = 'parola-admin-de-test-123'; // aceeași ca în helpers/accounts.js
const PASSWORD = 'parola-de-test-123';

let server;
let base;
const call = apiCaller(() => ({ base }));

let firstAdminRegistration; // înregistrarea cu ADMIN_EMAIL făcută de „oricine”, înainte de vânzător
let admin;
let A; // Ion: FUMUR cu pedigree, evaluare și jurnal secrete
let B; // Vasile: alt cont activ
let C; // cumpărător
let R; // cont neactivat (doar citire)
let fumur;
let fumurFather;
let journalId;
let bOwn;
let tPending; // vânzare A → C în așteptare
let tReadOnly; // vânzare A → R în așteptare
let publicToken;
const emails = {};

const cookieOf = (r) => r.res.headers.get('set-cookie')?.split(';')[0];
const me = async (cookie) => (await call('/api/auth/me', { cookie })).data?.account;
const tokenOf = (url) => url.split('/p/')[1];

/** Cerere HTTP brută (fără normalizarea căii pe care o face fetch). */
function raw(method, urlPath, { headers = {}, body } = {}) {
  const u = new URL(base);
  return new Promise((resolve, reject) => {
    const req = http.request({ host: u.hostname, port: u.port, method, path: urlPath, headers }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        let data = null;
        try {
          data = JSON.parse(text);
        } catch {
          /* nu e JSON */
        }
        resolve({ status: res.statusCode, headers: res.headers, text, data });
      });
    });
    req.on('error', reject);
    if (body !== undefined) req.write(body);
    req.end();
  });
}

before(async () => {
  ({ server, base } = await startTestApp());
  // „Oricine” încearcă să-și facă cont cu emailul adminului (contul adminului se face doar la pornire, din setări).
  firstAdminRegistration = await call('/api/auth/register', {
    method: 'POST',
    auth: 'none',
    body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD, name: 'Oricine de pe internet', country: 'RO', phone: '0700 000 000', city: 'Brașov', acceptTerms: true },
  });
  admin = await adminCookie(call);
  A = await newAccount(call, 'Ion');
  B = await newAccount(call, 'Vasile');
  C = await newAccount(call, 'Cumpărător');
  R = await newAccount(call, 'Citire', { active: false });
  for (const [k, c] of Object.entries({ A, B, C, R })) emails[k] = (await me(c)).email;

  fumur = (await call('/api/pedigrees/import', { method: 'POST', cookie: A, body: { root: PEDIGREE_FOTO } })).data.pigeonId;
  await call(`/api/pigeons/${fumur}`, {
    method: 'PATCH',
    cookie: A,
    body: { name: 'FUMUR', status: 'reproducator', evaluation: { scores: { aripa: 5 }, calitati: 'SECRET-EVAL-A' } },
  });
  fumurFather = (await call(`/api/pigeons/${fumur}`, { cookie: A })).data.pigeon.fatherId;
  journalId = (await call(`/api/pigeons/${fumur}/journal`, { method: 'POST', cookie: A, body: { date: '2026-05-01', type: 'nota', text: 'JURNAL-SECRET-A' } })).data.entry.id;
  bOwn = (await call('/api/pigeons', { method: 'POST', cookie: B, body: { kind: 'own', ring: 'RO-26-555001', sex: 'F' } })).data.pigeon.id;

  const tp = (await call('/api/pigeons', { method: 'POST', cookie: A, body: { kind: 'own', ring: 'RO-26-700001' } })).data.pigeon.id;
  tPending = (await call(`/api/pigeons/${tp}/transfers`, { method: 'POST', cookie: A, body: { email: emails.C } })).data.transfer.id;
  const tr = (await call('/api/pigeons', { method: 'POST', cookie: A, body: { kind: 'own', ring: 'RO-26-700002' } })).data.pigeon.id;
  tReadOnly = (await call(`/api/pigeons/${tr}/transfers`, { method: 'POST', cookie: A, body: { email: emails.R } })).data.transfer.id;

  publicToken = tokenOf((await call(`/api/pigeons/${fumur}/public`, { method: 'POST', cookie: A })).data.url);
});
after(() => server?.close());

/* ------------------------------------------------------------------ IDOR ------------------------------------------------------------------ */

const NOPE = 99_999_999;

/** B cere resursa lui A: același 404 (status și corp) ca pentru un id care nu există. */
async function sameAsMissing(pathFor, opts = {}) {
  const theirs = await call(pathFor(fumur), { cookie: B, ...opts });
  const missing = await call(pathFor(NOPE), { cookie: B, ...opts });
  assert.equal(theirs.status, 404, `${pathFor(fumur)} → ${theirs.status} ${JSON.stringify(theirs.data)}`);
  assert.deepEqual(theirs.data, missing.data, `${pathFor(fumur)}: răspunsul diferă de cel pentru un id inexistent`);
}

test('IDOR: fișa porumbelului altui cont (GET / PATCH / DELETE) dă 404, ca un id inexistent', async () => {
  await sameAsMissing((id) => `/api/pigeons/${id}`);
  await sameAsMissing((id) => `/api/pigeons/${id}`, { method: 'PATCH', body: { name: 'FURAT' } });
  await sameAsMissing((id) => `/api/pigeons/${id}`, { method: 'DELETE' });
  const still = (await call(`/api/pigeons/${fumur}`, { cookie: A })).data.pigeon;
  assert.equal(still.name, 'FUMUR');
});

test('IDOR: părinții – nici pe porumbelul altuia, nici cu părinte din alt cont', async () => {
  await sameAsMissing((id) => `/api/pigeons/${id}/parents`, { method: 'PUT', body: { fatherId: null, motherId: null } });
  const asFather = await call(`/api/pigeons/${bOwn}/parents`, { method: 'PUT', cookie: B, body: { fatherId: fumurFather } });
  assert.equal(asFather.status, 404);
  const asMother = await call(`/api/pigeons/${bOwn}/parents`, { method: 'PUT', cookie: B, body: { motherId: fumur } });
  assert.equal(asMother.status, 404);
  assert.equal((await call(`/api/pigeons/${bOwn}`, { cookie: B })).data.pigeon.fatherId, null);
});

test('IDOR: jurnalul altui cont (citire, adăugare, ștergere)', async () => {
  await sameAsMissing((id) => `/api/pigeons/${id}/journal`);
  await sameAsMissing((id) => `/api/pigeons/${id}/journal`, { method: 'POST', body: { date: '2026-05-02', type: 'nota', text: 'x' } });
  const del = await call(`/api/journal/${journalId}`, { method: 'DELETE', cookie: B });
  assert.equal(del.status, 404);
  const entries = (await call(`/api/pigeons/${fumur}/journal`, { cookie: A })).data.entries;
  assert.ok(entries.some((e) => e.id === journalId), 'intrarea lui A a rămas');
});

test('IDOR: arbore, familie, consangvinizare, linii de sânge, pereche, rețea, pedigree', async () => {
  for (const p of ['tree', 'family', 'coi', 'bloodlines', 'pedigree', 'public']) await sameAsMissing((id) => `/api/pigeons/${id}/${p}`);
  await sameAsMissing((id) => `/api/network?rootId=${id}`);
  await sameAsMissing((id) => `/api/pairs/coi?sireId=${id}&damId=${bOwn}`);
  const dam = await call(`/api/pairs/coi?sireId=${bOwn}&damId=${fumur}`, { cookie: B });
  assert.equal(dam.status, 404);
});

test('IDOR: linkul public al altuia nu se poate porni, opri sau înlocui', async () => {
  await sameAsMissing((id) => `/api/pigeons/${id}/public`, { method: 'POST' });
  await sameAsMissing((id) => `/api/pigeons/${id}/public/new`, { method: 'POST' });
  await sameAsMissing((id) => `/api/pigeons/${id}/public`, { method: 'DELETE' });
  const still = await call(`/api/pigeons/${fumur}/public`, { cookie: A });
  assert.equal(tokenOf(still.data.url), publicToken, 'linkul lui A a rămas neschimbat');
  assert.equal((await call(`/api/public/${publicToken}`, { auth: 'none' })).status, 200);
});

test('IDOR: vânzările altora (accept / anulare) dau 404 ca o vânzare inexistentă; vânzătorul nu-și acceptă singur vânzarea', async () => {
  for (const action of ['accept', 'cancel']) {
    const theirs = await call(`/api/transfers/${tPending}/${action}`, { method: 'POST', cookie: B });
    const missing = await call(`/api/transfers/${NOPE}/${action}`, { method: 'POST', cookie: B });
    assert.equal(theirs.status, 404, action);
    assert.deepEqual(theirs.data, missing.data, action);
  }
  assert.equal((await call(`/api/transfers/${tPending}/accept`, { method: 'POST', cookie: A })).status, 404);
  const incoming = (await call('/api/transfers', { cookie: C })).data.incoming;
  const t = incoming.find((x) => x.id === tPending);
  assert.ok(t, 'vânzarea e încă în așteptare la cumpărător');
  // Cumpărătorul vede doar inelul, numele, vânzătorul (nimic din restul contului vânzătorului).
  assert.deepEqual(Object.keys(t).sort(), ['createdAt', 'id', 'includePrivate', 'name', 'ring', 'sellerName']);
  assert.deepEqual((await call('/api/transfers', { cookie: B })).data, { incoming: [], outgoing: [] });
});

test('IDOR: consola adminului e refuzată unui crescător (orice metodă, orice formă a căii)', async () => {
  const accId = (await me(A)).id;
  const probes = [
    ['GET', '/api/admin/accounts'],
    ['GET', `/api/admin/accounts/${accId}`],
    ['GET', '/API/ADMIN/accounts'],
    ['GET', '/api/admin/accounts/'],
    ['POST', `/api/admin/accounts/${accId}/subscription`, { start: '2026-01-01' }],
    ['POST', `/api/admin/accounts/${accId}/reads`, { amount: 100 }],
    ['POST', `/api/admin/accounts/${accId}/password-link`],
  ];
  for (const who of [B, R]) {
    for (const [method, p, body] of probes) {
      const r = await call(p, { method, cookie: who, body });
      assert.equal(r.status, 403, `${method} ${p} → ${r.status}`);
    }
  }
  for (const [method, p, body] of probes) assert.equal((await call(p, { method, auth: 'none', body })).status, 401, `${method} ${p} fără cont`);
  assert.equal((await me(B)).reads.allowed, 3, 'citirile în plus nu s-au schimbat (3 în primele 14 zile)');
});

test('fără cont: toate rutele cu date dau 401', async () => {
  const paths = [
    ['GET', '/api/pigeons'], ['POST', '/api/pigeons'], ['GET', `/api/pigeons/${fumur}`], ['GET', '/api/pigeons/lookup?ring=RO-15-412084'],
    ['GET', `/api/pigeons/${fumur}/tree`], ['GET', '/api/board'], ['GET', '/api/network'], ['GET', '/api/transfers'],
    ['POST', `/api/transfers/${tPending}/accept`], ['POST', '/api/pedigrees/import'], ['POST', `/api/public/${publicToken}/import`],
    ['GET', '/api/auth/me'], ['PATCH', '/api/auth/me'],
  ];
  for (const [method, p] of paths) {
    const r = await call(p, { method, auth: 'none', body: method === 'GET' ? undefined : {} });
    assert.equal(r.status, 401, `${method} ${p} → ${r.status}`);
  }
});

/* ------------------------------------------------------ existența inelelor în alt cont ------------------------------------------------------ */

test('separare: căutarea, lookup-ul, adăugarea și importul nu spun nimic despre inelele altui cont', async () => {
  const ring = 'RO-15-412084'; // FUMUR al lui A
  const look = await call(`/api/pigeons/lookup?ring=${encodeURIComponent(ring)}`, { cookie: B });
  assert.deepEqual(look.data.matches, []);
  const fatherRing = (await call(`/api/pigeons/${fumurFather}`, { cookie: A })).data.pigeon.ring.raw;
  assert.deepEqual((await call(`/api/pigeons/lookup?ring=${encodeURIComponent(fatherRing)}`, { cookie: B })).data.matches, []);
  for (const q of [ring, '412084', 'FUMUR', 'fumur', 'NL', '%', '_', '']) {
    const list = (await call(`/api/pigeons?q=${encodeURIComponent(q)}`, { cookie: B })).data.pigeons;
    assert.ok(list.every((p) => p.id === bOwn || p.ring?.raw?.startsWith('RO-26-55')), `q=${q}: ${JSON.stringify(list)}`);
  }
  // Același inel ca porumbel propriu în alt cont: merge, fără niciun indiciu.
  const own = await call('/api/pigeons', { method: 'POST', cookie: B, body: { kind: 'own', ring: '412084/15 RO' } });
  assert.equal(own.status, 201, JSON.stringify(own.data));
  // Importul unui pedigree cu aceleași inele: totul nou în contul lui B, fără conflicte din contul lui A.
  const imp = await call('/api/pedigrees/import', {
    method: 'POST',
    cookie: B,
    body: { root: { ring: 'RO-26-555777', father: { ring: fatherRing, text: 'alt text' }, mother: { ring: '1255168/13 RO F' } } },
  });
  assert.equal(imp.status, 201, JSON.stringify(imp.data));
  assert.deepEqual(imp.data.conflicts, []);
  assert.equal(imp.data.reused, 0, 'nimic refolosit din alt cont');
  const json = JSON.stringify(imp.data) + JSON.stringify(own.data) + JSON.stringify(look.data);
  for (const word of ['Ion', 'FUMUR', 'SECRET', 'Pestrit']) assert.ok(!json.includes(word), word);
  const board = JSON.stringify((await call('/api/board', { cookie: B })).data);
  const net = JSON.stringify((await call('/api/network', { cookie: B })).data);
  assert.ok(!board.includes('FUMUR') && !net.includes('FUMUR'));
});

test('separare: preluarea din linkul public copiază doar câmpurile publice și nu atinge contul proprietarului', async () => {
  const before = (await call('/api/pigeons', { cookie: A })).data.pigeons.length;
  const imp = await call(`/api/public/${publicToken}/import`, { method: 'POST', cookie: C, body: {} });
  assert.equal(imp.status, 201, JSON.stringify(imp.data));
  const copy = (await call(`/api/pigeons/${imp.data.pigeonId}`, { cookie: C })).data.pigeon;
  assert.equal(copy.status, null);
  assert.ok(!JSON.stringify(copy).includes('SECRET'));
  assert.deepEqual((await call(`/api/pigeons/${imp.data.pigeonId}/journal`, { cookie: C })).data.entries, []);
  assert.equal((await call('/api/pigeons', { cookie: A })).data.pigeons.length, before);
  // Linkul oprit: preluarea nu mai merge, cu același mesaj ca pentru un token inventat.
  const other = (await call('/api/pigeons', { method: 'POST', cookie: A, body: { kind: 'own', ring: 'RO-26-700010' } })).data.pigeon.id;
  const tok = tokenOf((await call(`/api/pigeons/${other}/public`, { method: 'POST', cookie: A })).data.url);
  await call(`/api/pigeons/${other}/public`, { method: 'DELETE', cookie: A });
  const stopped = await call(`/api/public/${tok}/import`, { method: 'POST', cookie: C, body: {} });
  const invented = await call(`/api/public/${'x'.repeat(22)}/import`, { method: 'POST', cookie: C, body: {} });
  assert.equal(stopped.status, 404);
  assert.deepEqual(stopped.data, invented.data);
});

test('existența unui cont: înregistrarea și vânzarea spun dacă emailul are cont (acceptat ca decizie de produs)', async () => {
  // Documentare: „Am uitat parola” nu spune nimic, dar „Cont nou” (fără cont, fără limită) și vânzarea spun.
  const forgot1 = await call('/api/auth/forgot', { method: 'POST', auth: 'none', body: { email: emails.B } });
  const forgot2 = await call('/api/auth/forgot', { method: 'POST', auth: 'none', body: { email: 'nimeni-123@exemplu.test' } });
  assert.deepEqual(forgot1.data, forgot2.data);
  const reg = await call('/api/auth/register', { method: 'POST', auth: 'none', body: { country: 'RO', phone: '0700 000 000', city: 'Brașov', acceptTerms: true, email: emails.B.toUpperCase(), password: PASSWORD, name: 'x' } });
  assert.equal(reg.status, 409);
  const p = (await call('/api/pigeons', { method: 'POST', cookie: A, body: { kind: 'own', ring: 'RO-26-700011' } })).data.pigeon.id;
  const unknown = await call(`/api/pigeons/${p}/transfers`, { method: 'POST', cookie: A, body: { email: 'nimeni-123@exemplu.test' } });
  assert.equal(unknown.status, 404);
  // Nimic altceva despre cumpărător: la un email cunoscut răspunsul e doar id + stare.
  const known = await call(`/api/pigeons/${p}/transfers`, { method: 'POST', cookie: A, body: { email: emails.B } });
  assert.deepEqual(Object.keys(known.data.transfer).sort(), ['id', 'status']);
  await call(`/api/transfers/${known.data.transfer.id}/cancel`, { method: 'POST', cookie: A });
});

// Acceptat (decizia din 2026-11-16): id-urile comune arată doar cam câți porumbei se adaugă în total, nu ai cui sau
// care; numerotarea pe cont ar cere schimbarea tuturor legăturilor. Testul rămâne ca documentare.
test.skip('separare: id-urile sunt numerotate în tot programul, deci un cont vede câți porumbei adaugă ceilalți', async () => {
  const p1 = (await call('/api/pigeons', { method: 'POST', cookie: B, body: { kind: 'own', ring: 'RO-26-555101' } })).data.pigeon.id;
  for (let i = 0; i < 3; i++) await call('/api/pigeons', { method: 'POST', cookie: A, body: { kind: 'own', ring: `RO-26-70020${i}` } });
  const p2 = (await call('/api/pigeons', { method: 'POST', cookie: B, body: { kind: 'own', ring: 'RO-26-555102' } })).data.pigeon.id;
  assert.equal(p2 - p1, 1, `B vede un salt de ${p2 - p1 - 1} id-uri: porumbeii adăugați între timp de alte conturi`);
});

/* ------------------------------------------------------------- adminul unic ------------------------------------------------------------- */

test('admin: nimeni nu poate deveni admin făcându-și cont cu ADMIN_EMAIL (contul se face doar din setări, la pornire)', async () => {
  assert.notEqual(firstAdminRegistration.status, 201, 'formularul de cont nou trebuie să refuze emailul vânzătorului');
  assert.equal(firstAdminRegistration.data?.account?.isAdmin ?? false, false);
  assert.equal((await me(admin)).isAdmin, true); // adminul adevărat, creat la pornire
});

test('admin: emailul adminului în altă formă (litere mari, spații, Kelvin, chirilic, caractere invizibile) nu dă admin', async () => {
  const variants = [
    ADMIN_EMAIL.toUpperCase(),
    `  ${ADMIN_EMAIL}  `,
    `﻿${ADMIN_EMAIL}`,
    ADMIN_EMAIL.replace('k', 'K'), // semnul Kelvin: în JS toLowerCase() → „k”
    ADMIN_EMAIL.replace('a', 'а'), // „а” chirilic
    `${ADMIN_EMAIL}​`, // spațiu de lățime zero
    ADMIN_EMAIL.replace('k', 'ｋ'), // „ｋ” lat
  ];
  for (const email of variants) {
    const r = await call('/api/auth/register', { method: 'POST', auth: 'none', body: { country: 'RO', phone: '0700 000 000', city: 'Brașov', acceptTerms: true, email, password: PASSWORD, name: 'Impostor' } });
    if (r.status === 201) {
      assert.equal(r.data.account.isAdmin, false, `${JSON.stringify(email)} a primit admin`);
      // Intră doar din linkul de confirmare; nici atunci nu e admin.
      const cookie = await confirmAndEnter(call, r.data.account.email);
      assert.equal((await call('/api/admin/accounts', { cookie })).status, 403, JSON.stringify(email));
    } else {
      assert.ok([400, 409].includes(r.status), `${JSON.stringify(email)} → ${r.status}`);
    }
  }
  // Emailul nu se poate schimba din „Contul meu” (și nici isAdmin).
  const patch = await call('/api/auth/me', { method: 'PATCH', cookie: B, body: { email: ADMIN_EMAIL, isAdmin: true, subscription: { active: true } } });
  assert.equal(patch.status, 200);
  assert.equal(patch.data.account.email, emails.B);
  assert.equal(patch.data.account.isAdmin, false);
});

// Acceptat (cerut de utilizator): vânzătorul vede linkul de parolă nouă ca să-l poată trimite pe telefon; cu el ar
// putea intra în contul omului. Linkul se trimite și pe email, iar folosirea lui apare în istoricul contului.
test.skip('admin: vede doar datele contului, dar linkul de parolă nouă îi dă acces la porumbeii crescătorului', async () => {
  const V = await newAccount(call, 'Victima');
  const vId = (await me(V)).id;
  await call('/api/pigeons', { method: 'POST', cookie: V, body: { kind: 'own', ring: 'RO-26-880001', name: 'PRIVAT-V' } });
  const detail = await call(`/api/admin/accounts/${vId}`, { cookie: admin });
  assert.ok(!JSON.stringify(detail.data).includes('PRIVAT-V'), 'consola arată doar metadate');
  const link = await call(`/api/admin/accounts/${vId}/password-link`, { method: 'POST', cookie: admin });
  assert.equal(link.status, 200);
  if (link.data.link) {
    const token = link.data.link.split('/parola-noua/')[1];
    const reset = await call('/api/auth/reset', { method: 'POST', auth: 'none', body: { token, password: 'aleasa-de-admin-123' } });
    const list = await call('/api/pigeons', { cookie: cookieOf(reset) });
    assert.ok(!JSON.stringify(list.data ?? {}).includes('PRIVAT-V'), 'adminul a intrat în contul crescătorului cu linkul primit în răspuns și i-a văzut porumbeii');
  }
});

/* ------------------------------------------------------------- doar citire ------------------------------------------------------------- */

test('doar citire: nicio cale de scriere nu ocolește 402 (litere mari, „/” la final, query, override, metode)', async () => {
  const body = { kind: 'own', ring: 'RO-26-990001' };
  const probes = [
    ['/api/pigeons', 'POST', body],
    ['/API/PIGEONS', 'POST', body],
    ['/api/pigeons/', 'POST', body],
    ['/api/pigeons?x=/api/auth/', 'POST', body],
    ['/api/pigeons?/api/admin', 'POST', body],
    ['/api/pedigrees/import', 'POST', { root: { ring: 'RO-26-990001' } }],
    [`/api/public/${publicToken}/import`, 'POST', {}],
    [`/api/transfers/${tReadOnly}/accept`, 'POST', undefined],
    [`/API/Transfers/${tReadOnly}/Accept`, 'POST', undefined],
  ];
  for (const [p, method, b] of probes) {
    const r = await call(p, { method, cookie: R, body: b });
    assert.equal(r.status, 402, `${method} ${p} → ${r.status} ${JSON.stringify(r.data)}`);
  }
  const override = await call('/api/pigeons', { method: 'POST', cookie: R, body, headers: { 'X-HTTP-Method-Override': 'GET' } });
  assert.equal(override.status, 402);
  // Căi brute pe care fetch le-ar normaliza: prefixele scutite (/api/auth, /api/admin) nu duc la alte rute.
  for (const p of ['/api/auth/../pigeons', '/api/admin/../pigeons', '/api/auth/%2e%2e/pigeons', '/api/auth%2F..%2Fpigeons', '/api/admin/..%2Fpigeons', '//api/pigeons', '/api/auth/./../pigeons']) {
    const r = await raw('POST', p, { headers: { Cookie: R, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    assert.ok(![200, 201].includes(r.status), `${p} → ${r.status}`);
  }
  const mine = (await call('/api/pigeons', { cookie: R })).data.pigeons;
  assert.equal(mine.length, 0, 'contul „doar citire” nu are niciun porumbel');
  assert.ok((await call('/api/transfers', { cookie: R })).data.incoming.some((t) => t.id === tReadOnly), 'vânzarea a rămas în așteptare');
});

/* -------------------------------------------------------------------- CSRF -------------------------------------------------------------------- */

test('CSRF: corpurile care nu sunt JSON sunt respinse (text/plain, formular, multipart, fără Content-Type)', async () => {
  const json = JSON.stringify({ kind: 'own', ring: 'RO-26-990002' });
  const types = ['text/plain', 'text/plain;charset=UTF-8', 'application/x-www-form-urlencoded', 'multipart/form-data; boundary=x', 'application/csp-report', 'application/x-json', 'application/vnd.api+json', null];
  for (const t of types) {
    const headers = { Cookie: A, 'Content-Length': Buffer.byteLength(json) };
    if (t) headers['Content-Type'] = t;
    const r = await raw('POST', '/api/pigeons', { headers, body: json });
    assert.equal(r.status, 415, `${t} → ${r.status}`);
  }
  const form = await raw('POST', '/api/pigeons', { headers: { Cookie: A, 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'kind=own&ring=RO-26-990002' });
  assert.equal(form.status, 415);
  const chunked = await raw('PATCH', '/api/auth/me', { headers: { Cookie: A, 'Content-Type': 'text/plain', 'Transfer-Encoding': 'chunked' }, body: '{"name":"CSRF"}' });
  assert.equal(chunked.status, 415);
  assert.deepEqual((await call('/api/pigeons/lookup?ring=RO-26-990002', { cookie: A })).data.matches, []);
  assert.notEqual((await me(A)).name, 'CSRF');
});

test('CSRF: un POST fără corp, venit din alt site, trece de verificarea JSON (rămâne doar SameSite=Lax)', async () => {
  const p = (await call('/api/pigeons', { method: 'POST', cookie: A, body: { kind: 'own', ring: 'RO-26-700050' } })).data.pigeon.id;
  // Ce trimite un <form method="post" enctype="text/plain"> fără câmpuri, dintr-o pagină străină.
  const r = await raw('POST', `/api/pigeons/${p}/public`, {
    headers: { Cookie: A, Origin: 'https://atacator.example', 'Sec-Fetch-Site': 'cross-site', 'Content-Type': 'text/plain', 'Content-Length': '0' },
  });
  assert.equal(r.status, 403, `linkul public a fost pornit dintr-un site străin: ${r.status} ${r.text}`);
});

test('cookie-ul de sesiune: HttpOnly, SameSite=Lax, Path=/; în bază doar amprenta', async () => {
  const r = await call('/api/auth/login', { method: 'POST', auth: 'none', body: { email: emails.B, password: PASSWORD } });
  const setCookie = r.res.headers.get('set-cookie');
  assert.match(setCookie, /HttpOnly/i);
  assert.match(setCookie, /SameSite=Lax/i);
  assert.match(setCookie, /Path=\//);
  const token = decodeURIComponent(cookieOf(r).split('=')[1]);
  const { one } = await import('../src/db.js');
  assert.equal(await one('SELECT 1 FROM sessions WHERE token_hash = ?', token), undefined);
  assert.ok(token.length >= 40);
});

/* ------------------------------------------------------------ SQL / intrări ostile ------------------------------------------------------------ */

test('SQL injection: q, filtre, inel, consola – parametri legați, fără scurgeri și fără 500', async () => {
  const qs = ["' OR '1'='1", "' OR 1=1 --", "'; DROP TABLE pigeons; --", '\\', "%' OR '%'='", '$1', '?', "') OR ('a'='a"];
  for (const q of qs) {
    const r = await call(`/api/pigeons?q=${encodeURIComponent(q)}`, { cookie: B });
    assert.equal(r.status, 200, `q=${q}`);
    assert.ok(r.data.pigeons.every((p) => !p.name?.includes('FUMUR')), `q=${q}`);
    const look = await call(`/api/pigeons/lookup?ring=${encodeURIComponent(`RO-15-412084${q}`)}`, { cookie: B });
    assert.equal(look.status, 200);
    assert.deepEqual(look.data.matches, []);
    const adm = await call(`/api/admin/accounts?q=${encodeURIComponent(q)}&filter=${encodeURIComponent(q)}`, { cookie: admin });
    assert.equal(adm.status, 200);
  }
  for (const [k, v] of [['status', "' OR 1=1 --"], ['sex', "M' OR '1'='1"], ['kind', "own' --"], ['year', '2026 OR 1=1'], ['status', 'a'], ['year', '1e400']]) {
    const r = await call(`/api/pigeons?${k}=${encodeURIComponent(v)}`, { cookie: B });
    assert.equal(r.status, 400, `${k}=${v} → ${r.status}`);
  }
  // Valori repetate (listă în query) nu ocolesc validarea.
  assert.equal((await call('/api/pigeons?status=reproducator&status=x', { cookie: B })).status, 400);
  // Semnul „?” și ghilimelele din date nu strică legarea parametrilor.
  const name = `x' ? "?" $1 ?`;
  const r = await call(`/api/pigeons/${bOwn}`, { method: 'PATCH', cookie: B, body: { name } });
  assert.equal(r.status, 200);
  assert.equal(r.data.pigeon.name, name);
  assert.ok((await call('/api/pigeons', { cookie: A })).data.pigeons.length > 0, 'tabelul există încă');
});

test('ReDoS: inele și căutări foarte lungi răspund repede', async () => {
  const inputs = ['1'.repeat(7000) + 'X', `RO ${'1 '.repeat(3000)}`, `${'A'.repeat(3000)} - ${'1'.repeat(3000)} L`, `${'1/'.repeat(3000)}`, `${' '.repeat(5000)}M`];
  for (const s of inputs) {
    for (const p of [`/api/pigeons/lookup?ring=${encodeURIComponent(s)}`, `/api/pigeons?q=${encodeURIComponent(s)}`]) {
      const t0 = performance.now();
      const r = await call(p, { cookie: B });
      const ms = performance.now() - t0;
      assert.ok(r.status < 500, `${p.slice(0, 40)} → ${r.status}`);
      assert.ok(ms < 1500, `${p.slice(0, 40)}… a durat ${Math.round(ms)} ms`);
    }
  }
});

test('prototype pollution: cheile __proto__ / constructor din JSON nu schimbă nimic', async () => {
  const send = (method, p, json, cookie = B) => raw(method, p, { headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: json });
  const created = await send('POST', '/api/pigeons', '{"kind":"own","ring":"RO-26-660001","__proto__":{"polluted":"da","isAdmin":true,"kind":"external"},"constructor":{"prototype":{"polluted":"da"}}}');
  assert.equal(created.status, 201, created.text);
  assert.equal(created.data.pigeon.kind, 'own');
  const meR = await send('PATCH', '/api/auth/me', '{"treeView":"evantai","__proto__":{"isAdmin":true,"showEmail":true}}');
  assert.equal(meR.status, 200);
  assert.equal(meR.data.account.isAdmin, false);
  assert.equal(meR.data.account.showEmail, false);
  const imp = await send('POST', '/api/pedigrees/import', '{"root":{"ring":"RO-26-660002","__proto__":{"father":{"ring":"RO-26-660003"}}},"__proto__":{"rootKind":"external"}}');
  assert.equal(imp.status, 201, imp.text);
  assert.equal(imp.data.created, 1);
  const ev = await send('PATCH', `/api/pigeons/${bOwn}`, '{"evaluation":{"scores":{"__proto__":5}}}');
  assert.equal(ev.status, 400);
  const ev2 = await send('PATCH', `/api/pigeons/${bOwn}`, '{"evaluation":{"scores":{"constructor":5}}}');
  assert.equal(ev2.status, 400);
  const adm = await send('POST', `/api/admin/accounts/${(await me(B)).id}/reads`, '{"amount":1,"__proto__":{"amount":1000}}', admin);
  assert.equal(adm.status, 200);
  assert.equal(({}).polluted, undefined);
  assert.equal(({}).isAdmin, undefined);
  assert.equal(Object.prototype.kind, undefined);
});

test('corp mare: 1 MB pe rutele obișnuite (413)', async () => {
  const big = JSON.stringify({ kind: 'own', ring: 'RO-26-990003', name: 'x'.repeat(2 * 1024 * 1024) });
  const r = await raw('POST', '/api/pigeons', { headers: { Cookie: B, 'Content-Type': 'application/json' }, body: big });
  assert.equal(r.status, 413);
});

test('corp mare: /api/pedigrees/read citește până la 17 MB (și dezarhivează gzip) înainte să verifice contul', async () => {
  // ~16 MB de JSON invalid, comprimat la câțiva KB: fără cont, răspunsul ar trebui să fie 401 fără să fie citit.
  const bomb = zlib.gzipSync(Buffer.concat([Buffer.from('{"mime":"image/png","data":"'), Buffer.alloc(16 * 1024 * 1024, 'A'), Buffer.from('"  INVALID')]));
  assert.ok(bomb.length < 100_000, `comprimat: ${bomb.length} octeți`);
  const t0 = performance.now();
  const r = await raw('POST', '/api/pedigrees/read', { headers: { 'Content-Type': 'application/json', 'Content-Encoding': 'gzip', 'Content-Length': bomb.length }, body: bomb });
  const ms = Math.round(performance.now() - t0);
  assert.equal(r.status, 401, `fără cont, ${bomb.length} octeți au fost dezarhivați la 16 MB și parsați (${r.status} ${r.text}, ${ms} ms)`);
});

/* ----------------------------------------------------------------- XSS, redirect ----------------------------------------------------------------- */

test('XSS: textele cu HTML rămân date (JSON, nosniff, CSP), fără nicio injectare HTML în interfață', async () => {
  const evil = '<img src=x onerror=alert(1)>';
  const p = await call('/api/pigeons', { method: 'POST', cookie: B, body: { kind: 'own', ring: 'RO-26-555900', name: evil, pedigreeText: '<script>alert(1)</script>', breederText: '"><svg onload=alert(1)>' } });
  assert.equal(p.status, 201);
  const tok = tokenOf((await call(`/api/pigeons/${p.data.pigeon.id}/public`, { method: 'POST', cookie: B })).data.url);
  const pub = await raw('GET', `/api/public/${tok}`);
  assert.match(pub.headers['content-type'], /^application\/json/);
  assert.equal(pub.headers['x-content-type-options'], 'nosniff');
  assert.match(pub.headers['content-security-policy'], /script-src 'self'(;|$)/);
  assert.equal(JSON.parse(pub.text).root.name, evil);
  // Nicio reflexie a căii în răspunsurile de eroare.
  const nf = await raw('GET', `/api/public/${encodeURIComponent('<script>alert(1)</script>')}`);
  assert.equal(nf.status, 404);
  assert.ok(!nf.text.includes('<script'));
  const unknown = await raw('GET', '/api/%3Cscript%3Ealert(1)%3C%2Fscript%3E');
  assert.ok(!unknown.text.includes('<script'));
  // Pagina publică: index.html cu CSP, fără scripturi inline.
  const page = await raw('GET', `/p/${tok}`);
  if (page.status === 200) {
    assert.match(page.headers['content-security-policy'], /script-src 'self'/);
    assert.ok(!/<script(?![^>]*\bsrc=)[^>]*>/i.test(page.text), 'script inline în index.html');
  }
  // Interfața: nicio legare [innerHTML], bypassSecurityTrust, outerHTML, insertAdjacentHTML, document.write, eval.
  const root = path.join(import.meta.dirname, '..', 'web', 'src');
  const sinks = /\[innerHTML\]|bypassSecurityTrust|outerHTML|insertAdjacentHTML|document\.write|\beval\(|new Function\(|innerHTML\s*=(?!\s*['"]{2})/;
  const bad = [];
  for (const f of fs.readdirSync(root, { recursive: true })) {
    if (!/\.(ts|html)$/.test(f) || f.endsWith('.spec.ts')) continue;
    const src = fs.readFileSync(path.join(root, f), 'utf8');
    if (sinks.test(src)) bad.push(f);
  }
  assert.deepEqual(bad, []);
});

test('redirect deschis: afterLoginUrl acceptă doar căi din program, iar serverul nu trimite în alt site', async () => {
  const src = fs.readFileSync(path.join(import.meta.dirname, '..', 'web', 'src', 'app', 'core', 'auth.ts'), 'utf8');
  const m = src.match(/export function afterLoginUrl\(\): string \{([\s\S]*?)\n\}/);
  assert.ok(m, 'afterLoginUrl găsit');
  const store = new Map();
  const sessionStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v), removeItem: (k) => store.delete(k) };
  const fn = new Function('sessionStorage', `const AFTER_LOGIN = 'porumbar.dupa-intrare';${m[1]}`);
  const run = (v) => (store.set('porumbar.dupa-intrare', v), fn(sessionStorage));
  for (const v of ['//atacator.example', 'https://atacator.example', 'javascript:alert(1)', 'atacator.example', '']) assert.equal(run(v), '/panou', v);
  assert.equal(run('/p/abc'), '/p/abc');
  // „/\\atacator.example” trece filtrul, dar rezultatul merge doar în router.navigateByUrl (navigare internă), nu în location.
  // Cont nou nu mai trimite nicăieri după înscriere (omul intră din linkul din email).
  for (const f of ['intra.ts', 'cont-nou.ts']) {
    const page = fs.readFileSync(path.join(import.meta.dirname, '..', 'web', 'src', 'app', 'pages', 'auth', f), 'utf8');
    if (f === 'intra.ts') assert.match(page, /router\.navigateByUrl\(afterLoginUrl\(\)\)/, f);
    assert.ok(!/location\.(href|assign|replace)/.test(page), f);
  }
  // Serverul: directoarele statice redirecționează doar în același site.
  for (const p of ['//atacator.example/%2e%2e', '//atacator.example/media', '/%2Fatacator.example/media', '///atacator.example/media', '/media', '/%5Catacator.example']) {
    const r = await raw('GET', p);
    const loc = r.headers.location;
    if (loc) assert.ok(loc.startsWith('/') && !loc.startsWith('//') && !loc.startsWith('/\\'), `${p} → Location: ${loc}`);
  }
});

/* ------------------------------------------------------------ parolă, sesiuni, login ------------------------------------------------------------ */

test('resetarea parolei: o singură folosire, expirare, sesiunile vechi se închid', async () => {
  const { sentMails } = await import('../src/mail.js');
  const { run } = await import('../src/db.js');
  const P = await newAccount(call, 'Resetare');
  const email = (await me(P)).email;
  sentMails.length = 0;
  await call('/api/auth/forgot', { method: 'POST', auth: 'none', body: { email: email.toUpperCase() } });
  assert.equal(sentMails.length, 1);
  assert.equal(sentMails[0].to, email, 'emailul pleacă la adresa din cont, nu la cea scrisă');
  const token = sentMails[0].text.match(/\/parola-noua\/(\S+)/)[1];
  const ok = await call('/api/auth/reset', { method: 'POST', auth: 'none', body: { token, password: 'parola-noua-1234' } });
  assert.equal(ok.status, 200);
  assert.equal((await call('/api/auth/me', { cookie: P })).status, 401, 'sesiunea veche s-a închis');
  const again = await call('/api/auth/reset', { method: 'POST', auth: 'none', body: { token, password: 'alta-parola-1234' } });
  assert.equal(again.status, 400);
  // Expirat.
  const pid = (await me(cookieOf(ok))).id;
  const link = (await call(`/api/admin/accounts/${pid}/password-link`, { method: 'POST', cookie: admin })).data.link;
  const t2 = link.split('/parola-noua/')[1];
  await run(`UPDATE password_resets SET expires_at = now() - interval '1 second' WHERE account_id = ? AND used_at IS NULL`, pid);
  assert.equal((await call('/api/auth/reset', { method: 'POST', auth: 'none', body: { token: t2, password: 'alta-parola-1234' } })).status, 400);
  // Token gol / ciudat.
  for (const t of ['', null, { $ne: 1 }, ['x'], 'x'.repeat(5000)]) {
    const r = await call('/api/auth/reset', { method: 'POST', auth: 'none', body: { token: t, password: 'alta-parola-1234' } });
    assert.equal(r.status, 400, JSON.stringify(t)?.slice(0, 20));
  }
});

test('resetarea parolei: după schimbarea parolei, celelalte linkuri încă nefolosite rămân valabile', async () => {
  const P = await newAccount(call, 'Doua linkuri');
  const pid = (await me(P)).id;
  const l1 = (await call(`/api/admin/accounts/${pid}/password-link`, { method: 'POST', cookie: admin })).data.link.split('/parola-noua/')[1];
  const l2 = (await call(`/api/admin/accounts/${pid}/password-link`, { method: 'POST', cookie: admin })).data.link.split('/parola-noua/')[1];
  assert.equal((await call('/api/auth/reset', { method: 'POST', auth: 'none', body: { token: l1, password: 'parola-omului-1234' } })).status, 200);
  const old = await call('/api/auth/reset', { method: 'POST', auth: 'none', body: { token: l2, password: 'parola-atacatorului-1' } });
  assert.equal(old.status, 400, 'un link mai vechi (de ex. un email interceptat) încă schimbă parola după ce omul și-a ales-o pe a lui');
});

test('limită: ghicitul token-urilor de resetare se oprește (429 de la același IP; resetările reușite nu se numără)', async () => {
  // Token-uri inventate la rând de la același IP: după prea multe greșeli vine 429. failuresOnly → doar cele eșuate se numără.
  let limited = false;
  let tried = 0;
  for (let i = 0; i < 40 && !limited; i++) {
    const r = await call('/api/auth/reset', { method: 'POST', auth: 'none', body: { token: `inventat-${i}-${'x'.repeat(40)}`, password: 'parola-noua-1234' } });
    if (r.status === 429) limited = true;
    else {
      assert.equal(r.status, 400, `încercarea ${i}: ${r.status}`);
      tried++;
    }
  }
  assert.ok(limited, `ghicitul token-urilor de resetare trebuie limitat (a mers de ${tried} ori)`);
});

test('sesiune: fixarea nu merge (token nou la intrare), ieșirea închide sesiunea pe server', async () => {
  const planted = 'porumbar_session=FIXAT-de-atacator-0123456789';
  const login = await call('/api/auth/login', { method: 'POST', cookie: planted, body: { email: emails.B, password: PASSWORD } });
  assert.equal(login.status, 200);
  const fresh = cookieOf(login);
  assert.notEqual(fresh, planted);
  assert.equal((await call('/api/auth/me', { cookie: planted })).status, 401);
  assert.equal((await call('/api/auth/me', { cookie: fresh })).status, 200);
  assert.equal((await call('/api/auth/logout', { method: 'POST', cookie: fresh })).status, 204);
  assert.equal((await call('/api/auth/me', { cookie: fresh })).status, 401, 'cookie-ul vechi nu mai merge după ieșire');
  // Cookie-uri ciudate nu dau 500 și nu intră.
  for (const c of ['porumbar_session=%E0%A4%A', 'porumbar_session=', "porumbar_session=' OR 1=1 --", 'porumbar_session=a; porumbar_session=b']) {
    assert.equal((await call('/api/auth/me', { cookie: c })).status, 401, c);
  }
});

test('login: limita de 10 încercări greșite se ocolește cu spații în jurul emailului', async () => {
  const L = await newAccount(call, 'Forta bruta');
  const email = (await me(L)).email;
  for (let i = 0; i < 10; i++) {
    const r = await call('/api/auth/login', { method: 'POST', auth: 'none', body: { email, password: `gresita-${i}-xxxx` } });
    assert.equal(r.status, 401);
  }
  assert.equal((await call('/api/auth/login', { method: 'POST', auth: 'none', body: { email, password: 'gresita-x-xxxx' } })).status, 429);
  // Același cont, altă cheie de limitare (emailul nu e „trim”-uit în cheie, dar e la căutare): încercările continuă.
  const padded = await call('/api/auth/login', { method: 'POST', auth: 'none', body: { email: ` ${email}`, password: PASSWORD } });
  assert.equal(padded.status, 429, `cu „ ${email}” încercările continuă (${padded.status}): limita e pe forma scrisă, nu pe cont`);
});

test('login: încercările trimise în paralel trec toate de limita de 10', async () => {
  const L = await newAccount(call, 'Paralel');
  const email = (await me(L)).email;
  const results = await Promise.all(
    Array.from({ length: 20 }, (_, i) => call('/api/auth/login', { method: 'POST', auth: 'none', body: { email, password: `paralel-gresita-${i}` } })),
  );
  const tried = results.filter((r) => r.status === 401).length;
  assert.ok(tried <= 10, `${tried} parole verificate dintr-o rafală de 20 (limita e 10 la 15 minute)`);
});

/* ---------------------------------------------------------------- vânzarea ---------------------------------------------------------------- */

test('vânzare: anularea în timpul acceptării nu lasă o vânzare „anulată” cu porumbelul deja la cumpărător', async () => {
  // Strămoși comuni: acceptarea durează (importul a 15 căsuțe), cât să încapă o anulare în mijloc.
  const tree = (depth, prefix) => (depth === 0 ? null : { ring: `RO-20-${prefix}`, father: tree(depth - 1, `${prefix}1`), mother: tree(depth - 1, `${prefix}2`) });
  const bad = [];
  for (let i = 0; i < 4; i++) {
    const root = { ring: `RO-26-71000${i}`, father: tree(3, '81'), mother: tree(3, '92') };
    const id = (await call('/api/pedigrees/import', { method: 'POST', cookie: A, body: { root } })).data.pigeonId;
    const t = (await call(`/api/pigeons/${id}/transfers`, { method: 'POST', cookie: A, body: { email: emails.C } })).data.transfer.id;
    const accept = call(`/api/transfers/${t}/accept`, { method: 'POST', cookie: C });
    await new Promise((r) => setTimeout(r, 15));
    const cancel = call(`/api/transfers/${t}/cancel`, { method: 'POST', cookie: A });
    const [a, c] = await Promise.all([accept, cancel]);
    const status = (await call('/api/transfers', { cookie: A })).data.outgoing.find((x) => x.id === t).status;
    if (a.status === 200 && status !== 'accepted') bad.push({ i, accept: a.status, cancel: c.status, status });
  }
  assert.deepEqual(bad, [], 'porumbelul a ajuns la cumpărător, dar vânzarea apare „anulată” (vânzătorul îl poate vinde din nou)');
});

/* ---------------------------------------------------------------- linkul public ---------------------------------------------------------------- */

test('token public: 128 de biți, format strict, același 404 pentru orice token greșit; limită pe IP', async () => {
  assert.match(publicToken, /^[A-Za-z0-9_-]{22,}$/);
  const n1 = tokenOf((await call(`/api/pigeons/${fumur}/public/new`, { method: 'POST', cookie: A })).data.url);
  const n2 = tokenOf((await call(`/api/pigeons/${fumur}/public/new`, { method: 'POST', cookie: A })).data.url);
  assert.notEqual(n1, n2);
  assert.equal((await call(`/api/public/${publicToken}`, { auth: 'none' })).status, 404, 'linkul înlocuit nu mai merge');
  const ref = await call(`/api/public/${'A'.repeat(22)}`, { auth: 'none' });
  assert.equal(ref.status, 404);
  for (const t of ['abc', 'A'.repeat(65), '..%2F..%2Fapi%2Fhealth', "' OR '1'='1", '%00', n1.slice(0, -1), `${n1}x`, n1.toLowerCase() === n1 ? n1.toUpperCase() : n1.toLowerCase()]) {
    const r = await call(`/api/public/${t}`, { auth: 'none' });
    assert.equal(r.status, 404, t);
    assert.deepEqual(r.data, ref.data, t);
  }
  assert.equal((await call(`/api/public/${n2}`, { auth: 'none' })).status, 200);
  // Limita: 60 pe minut de la același IP.
  let limited = false;
  for (let i = 0; i < 70 && !limited; i++) limited = (await call(`/api/public/${'B'.repeat(22)}${i}`, { auth: 'none' })).status === 429;
  assert.ok(limited, 'ghicitul tokenurilor e limitat');
});
