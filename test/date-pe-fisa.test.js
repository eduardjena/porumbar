import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { apiCaller } from './helpers/api.js';
import { startTestApp } from './helpers/db.js';
import { adminCookie, newAccount, today } from './helpers/accounts.js';

// Datele de pe fișă (numele de jos, telefonul, adresa) le pune doar vânzătorul; omul alege doar ce se vede.
let server;
let base;
let admin;
let a;
let aId;
let pigeon;
const call = apiCaller(() => ({ base }));
const me = async (cookie) => (await call('/api/auth/me', { cookie })).data.account;
const identity = (id, body) => call(`/api/admin/accounts/${id}/identity`, { method: 'PATCH', cookie: admin, body });
const pedigree = async () => (await call(`/api/pigeons/${pigeon.id}/pedigree`, { cookie: a })).data;

// CNP fictiv, dar cu cifra de control corectă.
const CNP = '1800101420010';

before(async () => {
  ({ server, base } = await startTestApp());
  admin = await adminCookie(call);
  a = await newAccount(call, 'Ion');
  aId = (await me(a)).id;
  pigeon = (await call('/api/pigeons', { method: 'POST', cookie: a, body: { kind: 'own', ring: 'RO-26-800546' } })).data.pigeon;
});
after(() => server?.close());

test('crescătorul nu-și poate schimba numele, numele de pe fișă, telefonul sau adresa', async () => {
  for (const body of [{ name: 'Altul' }, { pedigreeName: 'Vecinul Team' }, { phone: '0799 999 999' }, { address: 'Altă stradă' }]) {
    const r = await call('/api/auth/me', { method: 'PATCH', cookie: a, body });
    assert.equal(r.status, 403, JSON.stringify(body));
    assert.match(r.data.error, /vânzător|cel de la care/i);
  }
  // Bifele și vederea Arborelui merg în continuare.
  const ok = await call('/api/auth/me', { method: 'PATCH', cookie: a, body: { showPhone: true, printEmail: false, treeView: 'evantai' } });
  assert.equal(ok.status, 200, JSON.stringify(ok.data));
  assert.equal(ok.data.account.showPhone, true);
  assert.equal(ok.data.account.printEmail, false);
  await call('/api/auth/me', { method: 'PATCH', cookie: a, body: { showPhone: false, printEmail: true } });
});

test('vânzătorul pune datele (persoană fizică cu CNP); pe fișă apare numele pus de el; CNP-ul nu iese din consolă', async () => {
  const r = await identity(aId, {
    kind: 'pf', name: 'Ion Popescu', cnp: CNP, sheetName: 'Popescu-Ionescu Team', phone: '0722 000 111', address: 'Str. Exemplu 1\nBacău',
  });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.account.sheetName, 'Popescu-Ionescu Team');
  assert.equal(r.data.account.cnp, CNP);
  const acc = await me(a);
  assert.equal(acc.pedigreeName, 'Popescu-Ionescu Team');
  assert.equal(acc.name, 'Ion Popescu');
  assert.equal(acc.phone, '0722 000 111');
  assert.ok(!JSON.stringify(acc).includes(CNP), 'CNP-ul nu ajunge la crescător');
  const ped = await pedigree();
  assert.equal(ped.owner.name, 'Popescu-Ionescu Team');
  assert.ok(!JSON.stringify(ped).includes(CNP));
  const detail = await call(`/api/admin/accounts/${aId}`, { cookie: admin });
  assert.ok(detail.data.events.some((e) => e.kind === 'identity'));
});

test('firmă: denumire, CUI, Reg. Com.; datele greșite sunt refuzate', async () => {
  const r = await identity(aId, { kind: 'firma', name: 'Ion Popescu', companyName: 'Columba Prod SRL', cui: 'RO12345678', regCom: 'J04/123/2020', sheetName: 'Columba Prod' });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.account.kind, 'firma');
  assert.equal(r.data.account.cui, 'RO12345678');
  assert.equal(r.data.account.cnp, null, 'la firmă nu rămâne CNP-ul vechi');
  assert.equal((await pedigree()).owner.name, 'Columba Prod');
  for (const bad of [
    { kind: 'pf', name: 'X', cnp: '1800101420011', sheetName: 'X' }, // cifra de control greșită
    { kind: 'pf', name: 'X', cnp: '12345', sheetName: 'X' },
    { kind: 'firma', name: 'X', cui: 'ABC', sheetName: 'X' },
    { kind: 'altceva', name: 'X', sheetName: 'X' },
    { kind: 'pf', name: '', sheetName: 'X' },
  ]) assert.equal((await identity(aId, bad)).status, 400, JSON.stringify(bad));
  // Doar adminul.
  assert.equal((await call(`/api/admin/accounts/${aId}/identity`, { method: 'PATCH', cookie: a, body: { kind: 'pf', name: 'X', sheetName: 'X' } })).status, 403);
  await identity(aId, { kind: 'pf', name: 'Ion Popescu', sheetName: 'Popescu-Ionescu Team', phone: '0722 000 111', address: 'Str. Exemplu 1' });
});

test('CNP-ul lipit cu spații se acceptă; istoricul ține ce era înainte și ce e acum', async () => {
  const r = await identity(aId, { kind: 'pf', name: 'Ion Popescu', cnp: ' 1800101 420010 ', sheetName: 'Popescu-Ionescu Team', phone: '0722 000 222', address: 'Str. Exemplu 1' });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.account.cnp, CNP);
  const ev = (await call(`/api/admin/accounts/${aId}`, { cookie: admin })).data.events.find((e) => e.kind === 'identity');
  assert.match(ev.note, /telefon: 0722 000 111 → 0722 000 222/);
  await identity(aId, { kind: 'pf', name: 'Ion Popescu', sheetName: 'Popescu-Ionescu Team', phone: '0722 000 111', address: 'Str. Exemplu 1' });
});

test('fără numele de pe fișă abonamentul nu se activează', async () => {
  const c = await newAccount(call, 'Fără', { active: false });
  const id = (await me(c)).id;
  const no = await call(`/api/admin/accounts/${id}/subscription`, { method: 'POST', cookie: admin, body: { start: today() } });
  assert.equal(no.status, 400);
  assert.match(no.data.error, /numele de pe fișă/i);
  await identity(id, { kind: 'pf', name: 'Fără Nume', sheetName: 'Fără Nume' });
  assert.equal((await call(`/api/admin/accounts/${id}/subscription`, { method: 'POST', cookie: admin, body: { start: today() } })).status, 200);
});

test('crescător nou plătit din consolă: cere numele de pe fișă; datele trec direct', async () => {
  const body = { name: 'Vasile Nou', email: 'vasile.fisa@exemplu.test', activate: true, start: today() };
  const no = await call('/api/admin/accounts', { method: 'POST', cookie: admin, body });
  assert.equal(no.status, 400);
  assert.match(no.data.error, /numele de pe fișă/i);
  const ok = await call('/api/admin/accounts', { method: 'POST', cookie: admin, body: { ...body, kind: 'pf', cnp: CNP, sheetName: 'Vasile Team', address: 'Str. Nouă 2' } });
  assert.equal(ok.status, 201, JSON.stringify(ok.data));
  assert.equal(ok.data.account.sheetName, 'Vasile Team');
  assert.equal(ok.data.account.cnp, CNP);
  assert.equal(ok.data.account.status, 'active');
});

test('bife separate: pe fișă implicit tot, la link implicit doar numele', async () => {
  const acc = await me(a);
  assert.deepEqual([acc.printPhone, acc.printAddress, acc.printEmail], [true, true, true]);
  assert.deepEqual([acc.showPhone, acc.showAddress, acc.showEmail], [false, false, false]);
  let ped = await pedigree();
  assert.equal(ped.owner.phone, '0722 000 111');
  assert.equal(ped.owner.address, 'Str. Exemplu 1');
  assert.equal(ped.owner.email, acc.email);
  const on = await call(`/api/pigeons/${pigeon.id}/public`, { method: 'POST', cookie: a });
  const pub = (await call(`/api/public/${on.data.url.split('/p/')[1]}`, { auth: 'none' })).data;
  assert.deepEqual(Object.keys(pub.owner), ['name']);
  await call('/api/auth/me', { method: 'PATCH', cookie: a, body: { printPhone: false, printEmail: false } });
  ped = await pedigree();
  assert.equal(ped.owner.phone, undefined);
  assert.equal(ped.owner.email, undefined);
  assert.equal(ped.owner.address, 'Str. Exemplu 1');
  assert.equal(ped.owner.name, 'Popescu-Ionescu Team', 'numele apare mereu');
});
