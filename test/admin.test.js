import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { apiCaller } from './helpers/api.js';
import { startTestApp } from './helpers/db.js';
import { adminCookie, newAccount, today } from './helpers/accounts.js';

let server;
let base;
let admin;
let mail;
const call = apiCaller(() => ({ base }));
before(async () => {
  ({ server, base } = await startTestApp());
  admin = await adminCookie(call);
  mail = await import('../src/mail.js');
});
after(() => server?.close());

const me = async (cookie) => (await call('/api/auth/me', { cookie })).data.account;
const addDays = (iso, days) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
const activate = (id, body) => call(`/api/admin/accounts/${id}/subscription`, { method: 'POST', cookie: admin, body });
const newPigeon = (cookie, ring) => call('/api/pigeons', { method: 'POST', cookie, body: { kind: 'own', ring } });

test('cont nou, neactivat: doar citire (vede, nu scrie), cu mesaj clar', async () => {
  const c = await newAccount(call, 'Nou', { active: false });
  const a = await me(c);
  assert.equal(a.subscription.status, 'pending');
  assert.equal(a.subscription.active, false);
  const w = await newPigeon(c, 'RO-26-100001');
  assert.equal(w.status, 402);
  assert.match(w.data.error, /doar citire|nu este activ/i);
  assert.equal((await call('/api/pigeons', { cookie: c })).status, 200);
  assert.equal((await call('/api/auth/me', { method: 'PATCH', cookie: c, body: { phone: '0700 000 000' } })).status, 200); // setările contului merg
});

test('adminul activează: un an de la data aleasă; apoi se poate scrie', async () => {
  const c = await newAccount(call, 'Plătitor', { active: false });
  const id = (await me(c)).id;
  const r = await activate(id, { start: '2026-11-16', note: 'plătit cash' });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.account.subscriptionStart, '2026-11-16');
  assert.equal(r.data.account.subscriptionEnd, '2027-11-16');
  const a = await me(c);
  assert.equal(a.subscription.end, '2027-11-16');
  assert.equal((await newPigeon(c, 'RO-26-100002')).status, 201);
});

test('abonament expirat: din nou doar citire, datele rămân', async () => {
  const c = await newAccount(call, 'Expirat');
  assert.equal((await newPigeon(c, 'RO-26-100003')).status, 201);
  const id = (await me(c)).id;
  await activate(id, { start: addDays(today(), -400) });
  const a = await me(c);
  assert.equal(a.subscription.status, 'expired');
  assert.equal((await newPigeon(c, 'RO-26-100004')).status, 402);
  const list = await call('/api/pigeons', { cookie: c });
  assert.equal(list.data.pigeons.length, 1);
});

test('consola: doar adminul; lista cu stările și numărul de porumbei, fără porumbeii lor', async () => {
  const c = await newAccount(call, 'Listat');
  assert.equal((await call('/api/admin/accounts', { cookie: c })).status, 403);
  assert.equal((await call('/api/admin/accounts', { auth: 'none' })).status, 401);
  await newPigeon(c, 'RO-26-100005');
  const id = (await me(c)).id;
  const r = await call('/api/admin/accounts', { cookie: admin });
  assert.equal(r.status, 200);
  const row = r.data.accounts.find((x) => x.id === id);
  assert.equal(row.status, 'active');
  assert.equal(row.pigeons, 1);
  assert.ok(r.data.counts.active >= 1);
  assert.ok(!JSON.stringify(r.data).includes('RO-26-100005'));
  const pending = await call('/api/admin/accounts?filter=pending', { cookie: admin });
  assert.ok(pending.data.accounts.every((x) => x.status === 'pending'));
  const found = await call(`/api/admin/accounts?q=${encodeURIComponent('Listat')}`, { cookie: admin });
  assert.ok(found.data.accounts.some((x) => x.id === id));
});

test('adminul are mereu acces, fără abonament', async () => {
  const a = await me(admin);
  assert.equal(a.isAdmin, true);
  assert.equal(a.subscription.active, true);
  assert.equal((await newPigeon(admin, 'RO-26-100006')).status, 201);
});

test('creditul pentru citiri: îl pune adminul; citirea scade costul real; la zero se oprește', async () => {
  const c = await newAccount(call, 'Cititor');
  const id = (await me(c)).id;
  const reader = await import('../src/pedigree-reader.js');
  reader.setPedigreeModel(async () => ({
    slots: [{ slot: 1, ring: 'RO-20-1', name: null, color: null, text: null, breeder: null }],
    rootSex: null,
    notes: '',
    usage: { input_tokens: 10_000, output_tokens: 5_000 }, // 0,04 $ + 0,10 $
  }));
  const photo = { mime: 'image/png', data: Buffer.from('x').toString('base64') };
  const none = await call('/api/pedigrees/read', { method: 'POST', cookie: c, body: photo });
  assert.equal(none.status, 402);
  assert.match(none.data.error, /credit/i);
  const cr = await call(`/api/admin/accounts/${id}/credit`, { method: 'POST', cookie: admin, body: { amount: 0.2, note: 'plătit' } });
  assert.equal(cr.status, 200, JSON.stringify(cr.data));
  assert.equal((await me(c)).aiCredit, 0.2);
  assert.equal((await call('/api/pedigrees/read', { method: 'POST', cookie: c, body: photo })).status, 200);
  assert.equal((await me(c)).aiCredit, 0.06);
  assert.equal((await call('/api/pedigrees/read', { method: 'POST', cookie: c, body: photo })).status, 200);
  assert.equal((await me(c)).aiCredit, 0); // nu sub zero
  assert.equal((await call('/api/pedigrees/read', { method: 'POST', cookie: c, body: photo })).status, 402);
  const detail = await call(`/api/admin/accounts/${id}`, { cookie: admin });
  assert.ok(detail.data.events.some((e) => e.kind === 'credit' && e.note === 'plătit'));
  reader.setPedigreeModel(null);
});

test('link de parolă nouă din consolă: emailul pleacă, adminul vede linkul, parola nu', async () => {
  const c = await newAccount(call, 'Uituc');
  const a = await me(c);
  const before = mail.sentMails.length;
  const r = await call(`/api/admin/accounts/${a.id}/password-link`, { method: 'POST', cookie: admin });
  assert.equal(r.status, 200);
  assert.match(r.data.link, /\/parola-noua\/[A-Za-z0-9_-]+$/);
  assert.equal(mail.sentMails.length, before + 1);
  assert.equal(mail.sentMails.at(-1).to, a.email);
  assert.ok(mail.sentMails.at(-1).text.includes(r.data.link));
  const token = r.data.link.split('/').pop();
  assert.equal((await call('/api/auth/reset', { method: 'POST', auth: 'none', body: { token, password: 'parola-noua-aleasa-de-el' } })).status, 200);
});

test('memento: cu o lună înainte, un singur email, și apare în consolă', async () => {
  const c = await newAccount(call, 'Aproape');
  const a = await me(c);
  await activate(a.id, { start: addDays(today(), -345) }); // expiră peste 20 de zile
  const { sendReminders } = await import('../src/subscriptions.js');
  const before = mail.sentMails.length;
  await sendReminders();
  const mine = mail.sentMails.slice(before).filter((m) => m.to === a.email);
  assert.equal(mine.length, 1);
  assert.match(mine[0].text, /expiră/);
  await sendReminders();
  assert.equal(mail.sentMails.slice(before).filter((m) => m.to === a.email).length, 1); // nu se repetă
  const list = await call('/api/admin/accounts?filter=expiring', { cookie: admin });
  const row = list.data.accounts.find((x) => x.id === a.id);
  assert.equal(row.status, 'expiring');
  assert.ok(row.reminderSentAt);
  // Prelungit: memento nou abia la următoarea expirare.
  await activate(a.id, { start: row.subscriptionEnd });
  await sendReminders();
  assert.equal(mail.sentMails.slice(before).filter((m) => m.to === a.email).length, 1);
});
