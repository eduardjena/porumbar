import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { apiCaller } from './helpers/api.js';
import { startTestApp } from './helpers/db.js';

let server;
let base;
before(async () => ({ server, base } = await startTestApp()));
after(() => server?.close());

let cookie = null;
const call = apiCaller(() => ({ base, cookie }));
const cookieOf = (r) => r.res.headers.get('set-cookie')?.split(';')[0] ?? null;
const PASS = 'parola-buna-123';

test('cont nou → intrat în cont', async () => {
  const r = await call('/api/auth/register', { method: 'POST', body: { email: 'Ion@Exemplu.test', password: PASS, name: 'Ion Popescu' } });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  assert.equal(r.data.account.email, 'Ion@Exemplu.test');
  cookie = cookieOf(r);
  assert.match(cookie, /^porumbar_session=/);
  const me = await call('/api/auth/me');
  assert.equal(me.status, 200);
  assert.equal(me.data.account.name, 'Ion Popescu');
});

test('parolă prea scurtă și email dublat', async () => {
  const short = await call('/api/auth/register', { method: 'POST', auth: 'none', body: { email: 'a@b.test', password: 'scurta', name: 'A' } });
  assert.equal(short.status, 400);
  assert.match(short.data.error, /cel puțin 10 caractere/);
  const dup = await call('/api/auth/register', { method: 'POST', auth: 'none', body: { email: 'ion@exemplu.TEST', password: PASS, name: 'Altul' } });
  assert.equal(dup.status, 409);
});

test('login greșit, logout', async () => {
  const bad = await call('/api/auth/login', { method: 'POST', auth: 'none', body: { email: 'ion@exemplu.test', password: 'gresita-1234' } });
  assert.equal(bad.status, 401);
  assert.equal(bad.data.error, 'Email sau parolă greșită.');
  const ok = await call('/api/auth/login', { method: 'POST', auth: 'none', body: { email: 'ion@exemplu.test', password: PASS } });
  assert.equal(ok.status, 200);
  const other = cookieOf(ok);
  assert.equal((await call('/api/auth/logout', { method: 'POST', cookie: other })).status, 204);
  assert.equal((await call('/api/auth/me', { cookie: other })).status, 401);
  assert.equal((await call('/api/auth/me')).status, 200, 'sesiunea cealaltă rămâne');
});

test('datele contului se pot schimba', async () => {
  const r = await call('/api/auth/me', { method: 'PATCH', body: { name: 'Ion P.', phone: '0700 000 000', address: 'Str. Exemplu 1' } });
  assert.equal(r.status, 200);
  assert.equal(r.data.account.phone, '0700 000 000');
});

test('parola uitată', async () => {
  const { sentMails } = await import('../src/mail.js');
  sentMails.length = 0;
  const none = await call('/api/auth/forgot', { method: 'POST', auth: 'none', body: { email: 'nimeni@exemplu.test' } });
  assert.equal(none.status, 200);
  assert.equal(sentMails.length, 0);
  const r = await call('/api/auth/forgot', { method: 'POST', auth: 'none', body: { email: 'ION@exemplu.test' } });
  assert.equal(r.status, 200);
  assert.equal(sentMails.length, 1);
  const link = sentMails[0].text.match(/https?:\/\/\S+\/parola-noua\/(\S+)/);
  assert.ok(link, sentMails[0].text);
  const token = link[1];

  const NEW = 'parola-noua-456';
  const reset = await call('/api/auth/reset', { method: 'POST', auth: 'none', body: { token, password: NEW } });
  assert.equal(reset.status, 200);
  assert.equal((await call('/api/auth/me')).status, 401, 'celelalte sesiuni s-au închis');
  cookie = cookieOf(reset);
  assert.equal((await call('/api/auth/me')).status, 200);
  const again = await call('/api/auth/reset', { method: 'POST', auth: 'none', body: { token, password: 'alta-parola-789' } });
  assert.equal(again.status, 400);
  assert.equal(again.data.error, 'Linkul a expirat sau a fost folosit.');
});

test('linkul expirat nu merge', async () => {
  const { sentMails } = await import('../src/mail.js');
  const { run } = await import('../src/db.js');
  sentMails.length = 0;
  await call('/api/auth/forgot', { method: 'POST', auth: 'none', body: { email: 'ion@exemplu.test' } });
  const token = sentMails[0].text.match(/\/parola-noua\/(\S+)/)[1];
  await run(`UPDATE password_resets SET expires_at = now() - interval '1 minute' WHERE used_at IS NULL`);
  const r = await call('/api/auth/reset', { method: 'POST', auth: 'none', body: { token, password: 'alta-parola-789' } });
  assert.equal(r.status, 400);
});

test('ștergerea contului', async () => {
  const bad = await call('/api/auth/me', { method: 'DELETE', body: { password: 'gresita-1234' } });
  assert.equal(bad.status, 401);
  const ok = await call('/api/auth/me', { method: 'DELETE', body: { password: 'parola-noua-456' } });
  assert.equal(ok.status, 204);
  const login = await call('/api/auth/login', { method: 'POST', auth: 'none', body: { email: 'ion@exemplu.test', password: 'parola-noua-456' } });
  assert.equal(login.status, 401);
});

test('vederea de pornire a Arborelui (Review Focus 4)', async () => {
  const { newAccount } = await import('./helpers/accounts.js');
  const c = await newAccount(call, 'V');
  const me = await call('/api/auth/me', { cookie: c });
  assert.equal(me.data.account.treeView, 'carduri', 'implicit');
  const ok = await call('/api/auth/me', { method: 'PATCH', cookie: c, body: { treeView: 'evantai' } });
  assert.equal(ok.status, 200);
  assert.equal(ok.data.account.treeView, 'evantai');
  assert.equal((await call('/api/auth/me', { method: 'PATCH', cookie: c, body: { treeView: 'inventat' } })).status, 400);
  assert.equal((await call('/api/auth/me', { cookie: c })).data.account.treeView, 'evantai');
});
