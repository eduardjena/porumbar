import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { apiCaller } from './helpers/api.js';
import { startTestApp } from './helpers/db.js';
import { newAccount, setLang } from './helpers/accounts.js';
import { PEDIGREE_FOTO } from './fixtures/pedigree-foto.js';

let server;
let base;
const call = apiCaller(() => ({ base }));
before(async () => {
  ({ server, base } = await startTestApp());
});
after(() => server?.close());

const emailOf = async (cookie) => (await call('/api/auth/me', { cookie })).data.account.email;

/** Vânzătorul cu FUMUR (pedigree complet, note, jurnal). */
async function seller() {
  const s = await newAccount(call, 'Vânzător');
  const id = (await call('/api/pedigrees/import', { method: 'POST', cookie: s, body: { root: PEDIGREE_FOTO } })).data.pigeonId;
  await call(`/api/pigeons/${id}`, { method: 'PATCH', cookie: s, body: { name: 'FUMUR', status: 'reproducator', evaluation: { scores: { aripa: 5 }, calitati: 'zbor bun' } } });
  await call(`/api/pigeons/${id}/journal`, { method: 'POST', cookie: s, body: { date: '2026-05-01', type: 'nota', text: 'Jurnal de test' } });
  return { s, id };
}

const sell = (cookie, id, email, includePrivate = false) => call(`/api/pigeons/${id}/transfers`, { method: 'POST', cookie, body: { email, includePrivate } });

test('vânzare acceptată: cumpărătorul are porumbelul propriu cu arborele, vânzătorul îl are „Vândut”', async () => {
  const { s, id } = await seller();
  const buyer = await newAccount(call, 'Cumpărător');
  const t = await sell(s, id, await emailOf(buyer));
  assert.equal(t.status, 201, JSON.stringify(t.data));
  const inbox = await call('/api/transfers', { cookie: buyer });
  assert.equal(inbox.data.incoming.length, 1);
  assert.equal(inbox.data.incoming[0].ring, 'RO-15-412084');
  assert.match(inbox.data.incoming[0].sellerName, /Vânzător/);
  assert.equal(inbox.data.incoming[0].pigeonId, undefined); // id-ul din contul vânzătorului nu se dă
  const ok = await call(`/api/transfers/${t.data.transfer.id}/accept`, { method: 'POST', cookie: buyer });
  assert.equal(ok.status, 200, JSON.stringify(ok.data));
  const mine = (await call(`/api/pigeons/${ok.data.pigeonId}`, { cookie: buyer })).data.pigeon;
  assert.equal(mine.kind, 'own');
  assert.equal(mine.name, 'FUMUR');
  assert.match(mine.sourceNote, /^Cumpărat de la Vânzător/);
  assert.equal(mine.evaluation.calitati ?? null, null); // fără includePrivate
  assert.equal((await call(`/api/pigeons/${ok.data.pigeonId}/journal`, { cookie: buyer })).data.entries.length, 0);
  const tree = (await call(`/api/pigeons/${ok.data.pigeonId}/tree?generations=4`, { cookie: buyer })).data;
  assert.ok(Object.keys(tree.pigeons).length >= 25);
  const sold = (await call(`/api/pigeons/${id}`, { cookie: s })).data.pigeon;
  assert.equal(sold.status, 'vandut');
  assert.equal(sold.evaluation.calitati, 'zbor bun'); // vânzătorul păstrează tot
  assert.equal((await sell(s, id, await emailOf(buyer))).status, 409); // nu se vinde de două ori
});

test('cu notele și jurnalul: cumpărătorul primește o copie a lor', async () => {
  const { s, id } = await seller();
  const buyer = await newAccount(call, 'Cumpărător');
  const t = await sell(s, id, await emailOf(buyer), true);
  const ok = await call(`/api/transfers/${t.data.transfer.id}/accept`, { method: 'POST', cookie: buyer });
  const mine = (await call(`/api/pigeons/${ok.data.pigeonId}`, { cookie: buyer })).data.pigeon;
  assert.equal(mine.evaluation.calitati, 'zbor bun');
  const j = (await call(`/api/pigeons/${ok.data.pigeonId}/journal`, { cookie: buyer })).data.entries;
  assert.equal(j.length, 1);
  assert.equal(j[0].text, 'Jurnal de test');
});

test('cumpărătorul avea inelul ca „din alt porumbar”: același rând devine al lui, cu legăturile lui (Review Focus 4)', async () => {
  const { s, id } = await seller();
  const buyer = await newAccount(call, 'Cumpărător');
  const ext = await call('/api/pigeons', { method: 'POST', cookie: buyer, body: { kind: 'external', ring: 'RO-15-412084' } });
  const kid = await call('/api/pigeons', { method: 'POST', cookie: buyer, body: { kind: 'own', ring: 'RO-25-123123' } });
  await call(`/api/pigeons/${kid.data.pigeon.id}/parents`, { method: 'PUT', cookie: buyer, body: { fatherId: ext.data.pigeon.id, motherId: null } });
  const t = await sell(s, id, await emailOf(buyer));
  const ok = await call(`/api/transfers/${t.data.transfer.id}/accept`, { method: 'POST', cookie: buyer });
  assert.equal(ok.data.pigeonId, ext.data.pigeon.id);
  assert.equal((await call(`/api/pigeons/${ext.data.pigeon.id}`, { cookie: buyer })).data.pigeon.kind, 'own');
  const kidNow = (await call(`/api/pigeons/${kid.data.pigeon.id}`, { cookie: buyer })).data.pigeon;
  assert.equal(kidNow.fatherId, ext.data.pigeon.id);
});

test('anulat: nimic nu se schimbă; doar cumpărătorul acceptă; emailuri greșite', async () => {
  const { s, id } = await seller();
  const buyer = await newAccount(call, 'Cumpărător');
  const other = await newAccount(call, 'Altul');
  assert.equal((await sell(s, id, 'nimeni@exemplu.test')).status, 404);
  assert.equal((await sell(s, id, await emailOf(s))).status, 400);
  const t = await sell(s, id, await emailOf(buyer));
  assert.equal((await sell(s, id, await emailOf(other))).status, 409); // unul singur în așteptare
  assert.equal((await call(`/api/transfers/${t.data.transfer.id}/accept`, { method: 'POST', cookie: other })).status, 404);
  assert.equal((await call(`/api/transfers/${t.data.transfer.id}/accept`, { method: 'POST', cookie: s })).status, 404);
  assert.equal((await call(`/api/transfers/${t.data.transfer.id}/cancel`, { method: 'POST', cookie: buyer })).status, 200);
  assert.equal((await call(`/api/transfers/${t.data.transfer.id}/accept`, { method: 'POST', cookie: buyer })).status, 409);
  assert.equal((await call(`/api/pigeons/${id}`, { cookie: s })).data.pigeon.status, 'reproducator');
  assert.equal((await call('/api/pigeons?q=412084', { cookie: buyer })).data.pigeons.length, 0);
  const again = await sell(s, id, await emailOf(other));
  assert.equal(again.status, 201);
  const out = await call('/api/transfers', { cookie: s });
  assert.equal(out.data.outgoing.filter((x) => x.status === 'pending').length, 1);
});

test('vânzarea de la un cont ro către un cont ja păstrează inelul cum e scris (fără JPN), și după o editare', async () => {
  const s = await newAccount(call, 'Vânzător');
  const p = (await call('/api/pigeons', { method: 'POST', cookie: s, body: { kind: 'own', ring: '25-AB-01234', sex: 'M' } })).data.pigeon;
  assert.equal(p.ring.raw, '25-AB-01234');
  const buyer = await newAccount(call, 'Cumpărător');
  await setLang(call, (await call('/api/auth/me', { cookie: buyer })).data.account.id, 'ja');
  const t = await sell(s, p.id, await emailOf(buyer));
  assert.equal(t.status, 201, JSON.stringify(t.data));
  const ok = await call(`/api/transfers/${t.data.transfer.id}/accept`, { method: 'POST', cookie: buyer });
  assert.equal(ok.status, 200, JSON.stringify(ok.data));
  const mine = (await call(`/api/pigeons/${ok.data.pigeonId}`, { cookie: buyer })).data.pigeon;
  assert.equal(mine.ring.raw, '25-AB-01234');
  assert.equal(mine.ring.country, null);
  // O editare care nu atinge inelul (sau îl trimite neschimbat) nu-l face japonez.
  for (const body of [{ name: 'KAZE' }, { ring: '25-AB-01234', name: 'KAZE 2' }]) {
    const e = await call(`/api/pigeons/${ok.data.pigeonId}`, { method: 'PATCH', cookie: buyer, body });
    assert.equal(e.status, 200, JSON.stringify(e.data));
    assert.equal(e.data.pigeon.ring.raw, '25-AB-01234');
  }
});
