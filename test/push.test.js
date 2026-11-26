import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { generateVAPIDKeys } from 'web-push';
import { apiCaller } from './helpers/api.js';
import { startTestApp } from './helpers/db.js';
import { newAccount } from './helpers/accounts.js';

let server;
let base;
let setPushSender;
let pushToAccount;
let pushSendOptions;
let all;
let one;
const call = apiCaller(() => ({ base }));
const keys = generateVAPIDKeys();
const fakeSub = (n) => ({ endpoint: `https://fcm.googleapis.com/fcm/send/${n}`, keys: { p256dh: `p256dh-${n}`, auth: `auth-${n}` } });
const subscribe = (cookie, n) => call('/api/auth/push', { method: 'POST', cookie, body: fakeSub(n) });
const endpointsOf = async (id) => (await all('SELECT endpoint FROM push_subscriptions WHERE account_id = ? ORDER BY id', id)).map((r) => r.endpoint);
const idOf = async (cookie) => (await call('/api/auth/me', { cookie })).data.account.id;

before(async () => {
  ({ server, base } = await startTestApp());
  ({ setPushSender, pushToAccount, pushSendOptions } = await import('../src/push.js'));
  ({ all, one } = await import('../src/db.js'));
});
after(() => server?.close());
beforeEach(() => {
  setPushSender(null);
  for (const k of ['VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_SUBJECT']) delete process.env[k];
});

test('fără chei VAPID: config 404; cu chei: 200 cu cheia publică', async () => {
  const a = await newAccount(call, 'A');
  assert.equal((await call('/api/auth/push/config', { cookie: a })).status, 404);
  process.env.VAPID_PUBLIC_KEY = keys.publicKey;
  process.env.VAPID_PRIVATE_KEY = keys.privateKey;
  process.env.VAPID_SUBJECT = 'mailto:test@exemplu.test';
  const r = await call('/api/auth/push/config', { cookie: a });
  assert.equal(r.status, 200);
  assert.equal(r.data.publicKey, keys.publicKey);
});

test('abonare, preluare de alt cont, ștergere; user_agent scurt; pushDevices în /me', async () => {
  const a = await newAccount(call, 'A');
  const b = await newAccount(call, 'B');
  const [ia, ib] = [await idOf(a), await idOf(b)];
  const r = await call('/api/auth/push', { method: 'POST', cookie: a, headers: { 'User-Agent': 'x'.repeat(500) }, body: fakeSub('mutat') });
  assert.equal(r.status, 201);
  const row = await one('SELECT user_agent FROM push_subscriptions WHERE endpoint = ?', fakeSub('mutat').endpoint);
  assert.ok(row.user_agent.length <= 200);
  assert.equal((await call('/api/auth/me', { cookie: a })).data.account.pushDevices, 1);
  assert.equal((await subscribe(b, 'mutat')).status, 201);
  assert.deepEqual(await endpointsOf(ia), []);
  assert.deepEqual(await endpointsOf(ib), [fakeSub('mutat').endpoint]);
  // A nu poate șterge abonamentul lui B; B îl poate.
  assert.equal((await call('/api/auth/push', { method: 'DELETE', cookie: a, body: { endpoint: fakeSub('mutat').endpoint } })).status, 204);
  assert.equal((await endpointsOf(ib)).length, 1);
  assert.equal((await call('/api/auth/push', { method: 'DELETE', cookie: b, body: { endpoint: fakeSub('mutat').endpoint } })).status, 204);
  assert.deepEqual(await endpointsOf(ib), []);
});

test('validare: http:// refuzat; al 11-lea dispozitiv îl înlocuiește pe cel mai vechi', async () => {
  const a = await newAccount(call, 'A');
  const id = await idOf(a);
  const bad = await call('/api/auth/push', { method: 'POST', cookie: a, body: { endpoint: 'http://fcm.googleapis.com/x', keys: { p256dh: 'p', auth: 'a' } } });
  assert.equal(bad.status, 400);
  assert.equal((await call('/api/auth/push', { method: 'POST', cookie: a, body: { endpoint: fakeSub(1).endpoint } })).status, 400);
  const long = await call('/api/auth/push', { method: 'POST', cookie: a, body: { endpoint: `https://fcm.googleapis.com/${'x'.repeat(1000)}`, keys: { p256dh: 'p', auth: 'a' } } });
  assert.equal(long.status, 400);
  for (let i = 1; i <= 11; i += 1) assert.equal((await subscribe(a, `d${i}`)).status, 201);
  const ends = await endpointsOf(id);
  assert.equal(ends.length, 10);
  assert.ok(!ends.includes(fakeSub('d1').endpoint));
  assert.ok(ends.includes(fakeSub('d11').endpoint));
});

test('pushToAccount: gone șterge abonamentul, ok pune last_ok_at, error îl păstrează', async () => {
  const a = await newAccount(call, 'A');
  const id = await idOf(a);
  await subscribe(a, 'g1');
  const calls = [];
  setPushSender(async (sub, payload) => {
    calls.push({ endpoint: sub.endpoint, payload });
    return 'gone';
  });
  const payload = { title: 'T', body: 'B', url: '/porumbar' };
  assert.deepEqual(await pushToAccount(id, payload), { sent: 0, failed: 1, devices: 1 });
  assert.deepEqual(calls, [{ endpoint: fakeSub('g1').endpoint, payload }]);
  assert.deepEqual(await endpointsOf(id), []);

  await subscribe(a, 'o1');
  await subscribe(a, 'e1');
  setPushSender(async (sub) => (sub.endpoint.endsWith('/o1') ? 'ok' : 'error'));
  assert.deepEqual(await pushToAccount(id, payload), { sent: 1, failed: 1, devices: 2 });
  assert.equal((await endpointsOf(id)).length, 2);
  const ok = await all('SELECT endpoint, last_ok_at FROM push_subscriptions WHERE account_id = ?', id);
  assert.ok(ok.find((r) => r.endpoint.endsWith('/o1')).last_ok_at);
  assert.equal(ok.find((r) => r.endpoint.endsWith('/e1')).last_ok_at, null);
  assert.deepEqual(await pushToAccount(await idOf(await newAccount(call, 'Fără')), payload), { sent: 0, failed: 0, devices: 0 });
});

test('POST /test trimite proba în limba contului, doar la dispozitivul contului', async () => {
  const a = await newAccount(call, 'A');
  const b = await newAccount(call, 'B');
  await subscribe(a, 't1');
  const calls = [];
  setPushSender(async (sub, payload) => {
    calls.push(payload);
    return 'ok';
  });
  const r = await call('/api/auth/push/test', { method: 'POST', cookie: a, body: { endpoint: fakeSub('t1').endpoint } });
  assert.equal(r.status, 200);
  assert.deepEqual(r.data, { result: 'ok' });
  assert.equal(calls[0].body, 'Proba: notificările merg');
  assert.equal((await call('/api/auth/push/test', { method: 'POST', cookie: b, body: { endpoint: fakeSub('t1').endpoint } })).status, 404);
  assert.equal(calls.length, 1);
});

test('cont doar-citire: se poate abona și își schimbă reminderEmail', async () => {
  const a = await newAccount(call, 'Citire', { active: false });
  assert.equal((await subscribe(a, 'ro1')).status, 201);
  assert.equal((await call('/api/auth/me', { cookie: a })).data.account.reminderEmail, true);
  const r = await call('/api/auth/me', { method: 'PATCH', cookie: a, body: { reminderEmail: false } });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.account.reminderEmail, false);
  assert.equal((await call('/api/auth/me', { cookie: a })).data.account.reminderEmail, false);
  assert.equal((await call('/api/auth/me', { method: 'PATCH', cookie: a, body: { reminderEmail: 'nu' } })).status, 400);
});

test('CSP-ul are worker-src self', async () => {
  const r = await call('/api/health', { auth: 'none' });
  assert.match(r.res.headers.get('content-security-policy'), /worker-src 'self'/);
});

test('adresa dispozitivului: doar serviciile de push cunoscute (fără SSRF)', async () => {
  const a = await newAccount(call, 'A');
  const post = (endpoint) => call('/api/auth/push', { method: 'POST', cookie: a, body: { endpoint, keys: { p256dh: 'p', auth: 'a' } } });
  for (const bad of [
    'https://127.0.0.1/x', 'https://169.254.169.254/', 'https://evil.example/x', 'https://[::1]/x', 'https://fcm.googleapis.com:8443/x',
    'https://fcm.googleapis.com.evil.example/x', 'https://evilpush.apple.com/x', 'https://user@fcm.googleapis.com/x', 'https://push.services.mozilla.com/x',
  ]) assert.equal((await post(bad)).status, 400, bad);
  for (const good of [
    'https://fcm.googleapis.com/fcm/send/abc', 'https://updates.push.services.mozilla.com/wpush/v2/abc', 'https://web.push.apple.com/abc',
    'https://wns2-par02p.notify.windows.com/w/abc', 'https://api.push.apple.com/3/device/abc',
  ]) assert.equal((await post(good)).status, 201, good);
});

test('POST /test are limită pe cont (5 pe minut)', async () => {
  const a = await newAccount(call, 'A');
  await subscribe(a, 'lim');
  setPushSender(async () => 'ok');
  const send = () => call('/api/auth/push/test', { method: 'POST', cookie: a, body: { endpoint: fakeSub('lim').endpoint } });
  for (let i = 0; i < 5; i += 1) assert.equal((await send()).status, 200);
  assert.equal((await send()).status, 429);
});

test('preluarea de alt cont șterge starea veche (last_ok_at, created_at nou)', async () => {
  const a = await newAccount(call, 'A');
  const b = await newAccount(call, 'B');
  await subscribe(a, 'tk');
  await one("UPDATE push_subscriptions SET last_ok_at = now(), created_at = '2020-01-01' WHERE endpoint = ? RETURNING id", fakeSub('tk').endpoint);
  await subscribe(b, 'tk');
  const row = await one('SELECT last_ok_at, created_at FROM push_subscriptions WHERE endpoint = ?', fakeSub('tk').endpoint);
  assert.equal(row.last_ok_at, null);
  assert.ok(new Date(row.created_at).getFullYear() > 2020);
});

test('trimiterea reală are timeout de 10 secunde', () => {
  assert.equal(pushSendOptions().timeout, 10_000);
});

test('REMINDER_EMAILS_PER_MINUTE: număr întreg ≥ 1, altfel 10', async () => {
  const { config } = await import('../src/config.js');
  const prev = process.env.REMINDER_EMAILS_PER_MINUTE;
  try {
    for (const [v, want] of [[undefined, 10], ['', 10], ['abc', 10], ['0', 1], ['-5', 1], ['2.7', 2], ['30', 30]]) {
      if (v === undefined) delete process.env.REMINDER_EMAILS_PER_MINUTE;
      else process.env.REMINDER_EMAILS_PER_MINUTE = v;
      assert.equal(config.reminderEmailsPerMinute, want, String(v));
    }
  } finally {
    if (prev === undefined) delete process.env.REMINDER_EMAILS_PER_MINUTE;
    else process.env.REMINDER_EMAILS_PER_MINUTE = prev;
  }
});
