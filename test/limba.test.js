import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { apiCaller } from './helpers/api.js';
import { startTestApp } from './helpers/db.js';
import { adminCookie, newAccount, setLang } from './helpers/accounts.js';

// Limba contului o pune vânzătorul; maghiara e „în probă” (nepublică) până o verifică cineva.
let server;
let base;
let admin;
const call = apiCaller(() => ({ base }));
const me = async (cookie) => (await call('/api/auth/me', { cookie })).data.account;
before(async () => {
  ({ server, base } = await startTestApp());
  admin = await adminCookie(call);
});
after(() => server?.close());

test('un cont nou e în română', async () => {
  const a = await newAccount(call, 'Ion');
  assert.equal((await me(a)).lang, 'ro');
});

test('vânzătorul pune maghiara; omul poate trece în română, dar nu se mai poate întoarce singur', async () => {
  const a = await newAccount(call, 'Sándor');
  const id = (await me(a)).id;
  await setLang(call, id, 'hu');
  assert.equal((await me(a)).lang, 'hu');
  assert.equal((await call(`/api/admin/accounts/${id}`, { cookie: admin })).data.account.lang, 'hu');
  assert.equal((await call('/api/auth/me', { method: 'PATCH', cookie: a, body: { lang: 'hu' } })).status, 200, 'rămâne în limba lui');
  assert.equal((await call('/api/auth/me', { method: 'PATCH', cookie: a, body: { lang: 'ro' } })).status, 200);
  assert.equal((await me(a)).lang, 'ro');
  assert.equal((await call('/api/auth/me', { method: 'PATCH', cookie: a, body: { lang: 'hu' } })).status, 403);
  await setLang(call, id, 'hu');
  assert.equal((await me(a)).lang, 'hu');
});

test('un cont în română nu-și poate pune singur o limbă în probă; o limbă necunoscută e refuzată', async () => {
  const a = await newAccount(call, 'Vasile');
  assert.equal((await call('/api/auth/me', { method: 'PATCH', cookie: a, body: { lang: 'hu' } })).status, 403);
  assert.equal((await call('/api/auth/me', { method: 'PATCH', cookie: a, body: { lang: 'xx' } })).status, 400);
  const id = (await me(a)).id;
  const row = (await call(`/api/admin/accounts/${id}`, { cookie: admin })).data.account;
  assert.equal((await call(`/api/admin/accounts/${id}/identity`, { method: 'PATCH', cookie: admin, body: { name: row.name, sheetName: row.sheetName, lang: 'xx' } })).status, 400);
});

test('înregistrarea: fără limbă e română; o limbă în probă nu se poate cere', async () => {
  const body = (email, lang) => ({ email, password: 'parola-de-test-123', name: 'Nou', ...(lang ? { lang } : {}) });
  const no = await call('/api/auth/register', { method: 'POST', auth: 'none', body: body('limba1@exemplu.test', 'hu') });
  assert.equal(no.status, 400);
  const ok = await call('/api/auth/register', { method: 'POST', auth: 'none', body: body('limba2@exemplu.test') });
  assert.equal(ok.status, 201);
  assert.equal(ok.data.account.lang, 'ro');
});

test('vânzătorul face un cont nou direct în maghiară', async () => {
  const r = await call('/api/admin/accounts', { method: 'POST', cookie: admin, body: { name: 'Kovács Béla', email: 'bela@exemplu.test', lang: 'hu' } });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  assert.equal(r.data.account.lang, 'hu');
});

test('fără cont, telefonul în maghiară primește încă româna (maghiara e în probă)', async () => {
  const r = await call('/api/auth/login', {
    method: 'POST', auth: 'none', headers: { 'Accept-Language': 'hu-HU,hu;q=0.9' }, body: { email: 'nimeni@exemplu.test', password: 'gresit-gresit-1' },
  });
  assert.equal(r.status, 401);
  assert.match(r.data.error, /^Email sau parolă greșită/);
});

test('mesajele serverului vin în limba contului (maghiară), iar în română rămân cele de azi', async () => {
  const a = await newAccount(call, 'Gábor');
  await setLang(call, (await me(a)).id, 'hu');
  const bad = await call('/api/pigeons', { method: 'POST', cookie: a, body: { kind: 'own', ring: 'xyz' } });
  assert.equal(bad.status, 400);
  assert.equal(bad.data.error, 'A gyűrűszám nem olvasható. Írd úgy, mint a példában: RO-25-123456.');
  const locked = await call('/api/auth/me', { method: 'PATCH', cookie: a, body: { name: 'Altul' } });
  assert.equal(locked.status, 403);
  assert.match(locked.data.error, /eladó/);
  const field = await call('/api/pigeons', { method: 'POST', cookie: a, body: { kind: 'own', ring: 'RO-26-800549', name: 'x'.repeat(200) } });
  assert.equal(field.status, 400);
  assert.doesNotMatch(field.data.error, /[ăâîșț]|camp\./, 'numele câmpului e și el tradus');
  const ro = await newAccount(call, 'Ion');
  const badRo = await call('/api/pigeons', { method: 'POST', cookie: ro, body: { kind: 'own', ring: 'xyz' } });
  assert.equal(badRo.data.error, 'Inelul nu poate fi citit. Scrie-l ca în exemplu: RO-25-123456.');
});

test('catalogul de la server vine în limba contului', async () => {
  const a = await newAccount(call, 'Ilona');
  await setLang(call, (await me(a)).id, 'hu');
  const hu = (await call('/api/catalog', { cookie: a })).data;
  assert.equal(hu.colors.find((c) => c.code === 'solzat').label, 'Kék kovácsolt');
  const none = (await call('/api/catalog', { auth: 'none' })).data;
  assert.equal(none.colors.find((c) => c.code === 'solzat').label, 'Solzat');
});

test('mesajele fără diacritice (serii, linii, an, culori, concurs) vin și ele în maghiară', async () => {
  const a = await newAccount(call, 'Lajos');
  await setLang(call, (await me(a)).id, 'hu');
  const colors = await call('/api/colors/predict', { method: 'POST', cookie: a, body: {} });
  assert.equal(colors.status, 400);
  assert.doesNotMatch(colors.data.error, /Lipsesc/);
  const lines = await call('/api/pigeons', { method: 'POST', cookie: a, body: { kind: 'own', ring: 'RO-26-800560', lines: Array.from({ length: 11 }, (_, i) => `L${i}`) } });
  assert.equal(lines.status, 400);
  assert.doesNotMatch(lines.data.error, /Cel mult/);
});

test('preluat de pe linkul unui crescător român: culoarea din listă rămâne cod, deci apare tradusă', async () => {
  const ro = await newAccount(call, 'Petru');
  const p = (await call('/api/pigeons', { method: 'POST', cookie: ro, body: { kind: 'own', ring: 'RO-26-800561', color: 'solzat', colorPa: true } })).data.pigeon;
  const link = (await call(`/api/pigeons/${p.id}/public`, { method: 'POST', cookie: ro })).data.url;
  const hu = await newAccount(call, 'Zoltán');
  await setLang(call, (await me(hu)).id, 'hu');
  const r = await call(`/api/public/${link.split('/p/')[1]}/import`, { method: 'POST', cookie: hu });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  const mine = (await call(`/api/pigeons/${r.data.pigeonId}`, { cookie: hu })).data.pigeon;
  assert.equal(mine.color, 'solzat');
  assert.equal(mine.colorPa, true);
  assert.equal(mine.colorText ?? null, null, 'fără textul românesc al culorii');
});
