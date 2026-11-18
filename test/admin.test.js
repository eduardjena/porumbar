import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { apiCaller } from './helpers/api.js';
import { startTestApp } from './helpers/db.js';
import { adminCookie, newAccount, setIdentity, today } from './helpers/accounts.js';

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
  assert.equal((await call('/api/auth/me', { method: 'PATCH', cookie: c, body: { showPhone: true } })).status, 200); // bifele contului merg
});

test('adminul activează: un an de la data aleasă; apoi se poate scrie', async () => {
  const c = await newAccount(call, 'Plătitor', { active: false });
  const id = (await me(c)).id;
  await setIdentity(call, id, { name: 'Plătitor', sheetName: 'Plătitor Team' });
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

// Citirile din poze (incluse în abonament, fără credit): test/citiri.test.js.
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

/* „Crescător nou” din consolă: contul fără parolă, cu link de activare (parola o alege omul). */

const createBreeder = (body, cookie = admin) => call('/api/admin/accounts', { method: 'POST', cookie, body });

test('crescător nou din consolă: cont fără parolă, link de activare pe 7 zile, apoi își alege singur parola', async () => {
  const before = mail.sentMails.length;
  const r = await createBreeder({ name: 'Gheorghe Test', email: 'gheorghe.nou@exemplu.test', phone: '0700 111 222' });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  assert.match(r.data.link, /\/parola-noua\/[A-Za-z0-9_-]+$/);
  assert.equal(r.data.account.status, 'pending');
  assert.equal(r.data.account.invited, true);
  assert.equal(r.data.account.phone, '0700 111 222');
  // Emailul cu linkul a plecat la el.
  const sent = mail.sentMails.slice(before).find((m) => m.to === 'gheorghe.nou@exemplu.test');
  assert.ok(sent && sent.text.includes(r.data.link));
  // Fără parolă nu intră; mesajul îl trimite la link.
  const login = await call('/api/auth/login', { method: 'POST', auth: 'none', body: { email: 'gheorghe.nou@exemplu.test', password: 'orice-parola-123' } });
  assert.equal(login.status, 401);
  assert.match(login.data.error, /linkul/);
  // Își alege parola din link și intră.
  const token = r.data.link.split('/').pop();
  const set = await call('/api/auth/reset', { method: 'POST', auth: 'none', body: { token, password: 'parola-aleasa-de-el' } });
  assert.equal(set.status, 200);
  assert.equal((await call('/api/auth/login', { method: 'POST', auth: 'none', body: { email: 'gheorghe.nou@exemplu.test', password: 'parola-aleasa-de-el' } })).status, 200);
  const row = (await call(`/api/admin/accounts/${r.data.account.id}`, { cookie: admin })).data;
  assert.equal(row.account.invited, false);
  assert.ok(row.events.some((e) => e.kind === 'created'));
});

test('crescător nou care a plătit deja: activat din același pas, cu citirile din poze incluse', async () => {
  const r = await createBreeder({ name: 'Ion Plătit', email: 'ion.platit@exemplu.test', sheetName: 'Ion Plătit', activate: true, start: today(), note: 'plătit cash' });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  assert.equal(r.data.account.status, 'active');
  assert.deepEqual(r.data.account.reads, { used: 0, allowed: 200, costUsd: 0 });
  const detail = await call(`/api/admin/accounts/${r.data.account.id}`, { cookie: admin });
  const kinds = detail.data.events.map((e) => e.kind);
  for (const k of ['created', 'subscription']) assert.ok(kinds.includes(k), k);
});

test('crescător nou: emailuri greșite sau ocupate, emailul adminului, cont care nu e admin', async () => {
  assert.equal((await createBreeder({ name: 'X', email: 'nu-e-email' })).status, 400);
  assert.equal((await createBreeder({ name: '', email: 'gol@exemplu.test' })).status, 400);
  assert.equal((await createBreeder({ name: 'Dublură', email: 'GHEORGHE.NOU@exemplu.test' })).status, 409);
  assert.equal((await createBreeder({ name: 'Admin', email: process.env.ADMIN_EMAIL })).status, 409);
  const c = await newAccount(call, 'Simplu');
  assert.equal((await createBreeder({ name: 'Y', email: 'y@exemplu.test' }, c)).status, 403);
});

test('crescătorul invitat care a pierdut linkul: „Link de parolă nouă” din consolă îi dă unul nou, tot pe 7 zile', async () => {
  const r = await createBreeder({ name: 'Uituc Invitat', email: 'uituc.invitat@exemplu.test' });
  const again = await call(`/api/admin/accounts/${r.data.account.id}/password-link`, { method: 'POST', cookie: admin });
  assert.equal(again.status, 200);
  assert.equal(again.data.hours, 168);
  const token = again.data.link.split('/').pop();
  assert.equal((await call('/api/auth/reset', { method: 'POST', auth: 'none', body: { token, password: 'parola-lui-noua-1' } })).status, 200);
});

/* Ultima intrare a crescătorului, în consolă (cerută de vânzător). */

test('consola arată ultima intrare în cont și ultima activitate; nimic pentru cine n-a intrat niciodată', async () => {
  const c = await newAccount(call, 'Intrare');
  const a = await me(c);
  const before = Date.now();
  const login = await call('/api/auth/login', { method: 'POST', auth: 'none', body: { email: a.email, password: 'parola-de-test-123' } });
  assert.equal(login.status, 200);
  const row = (await call(`/api/admin/accounts?q=${encodeURIComponent(a.email)}`, { cookie: admin })).data.accounts.find((x) => x.id === a.id);
  assert.ok(row.lastLoginAt, 'ultima intrare');
  assert.ok(Date.parse(row.lastLoginAt) >= before - 2000);
  assert.ok(row.lastSeenAt, 'ultima activitate');
  // După ieșire (sesiunea se șterge) ultima intrare rămâne.
  const cookie = login.res.headers.get('set-cookie').split(';')[0];
  await call('/api/auth/logout', { method: 'POST', cookie });
  const after = (await call(`/api/admin/accounts/${a.id}`, { cookie: admin })).data.account;
  assert.equal(after.lastLoginAt, row.lastLoginAt);
  // Făcut din consolă și neintrat încă: fără dată.
  const inv = await createBreeder({ name: 'Neintrat', email: 'neintrat@exemplu.test' });
  assert.equal(inv.data.account.lastLoginAt, null);
});

/* Cont nou din formular: vânzătorul (ADMIN_EMAIL) primește un mail, ca să-l contacteze și să-l activeze. */

test('cont nou din formular: adminul primește un mail cu numele și emailul omului', async () => {
  const before = mail.sentMails.length;
  const email = `mail-admin-${process.pid}@exemplu.test`;
  const r = await call('/api/auth/register', { method: 'POST', auth: 'none', body: { email, password: 'parola-de-test-123', name: 'Vasile Nou' } });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  const sent = mail.sentMails.slice(before).filter((m) => m.to === process.env.ADMIN_EMAIL);
  assert.equal(sent.length, 1);
  assert.match(sent[0].subject, /Cont nou/);
  assert.ok(sent[0].text.includes('Vasile Nou'));
  assert.ok(sent[0].text.includes(email));
  assert.ok(sent[0].text.includes('/vanzator'));
});
