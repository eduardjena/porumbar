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
