import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { apiCaller } from './helpers/api.js';
import { startTestApp } from './helpers/db.js';
import { newAccount } from './helpers/accounts.js';

/* Problemele găsite la recenzia Planului 3 (2026-11-16). */

let server;
let base;
const call = apiCaller(() => ({ base }));
before(async () => {
  ({ server, base } = await startTestApp());
});
after(() => server?.close());

const emailOf = async (cookie) => (await call('/api/auth/me', { cookie })).data.account.email;

test('un strămoș „din alt porumbar” devenit al meu (pedigree pe hârtie) își păstrează numele, sexul și textele', async () => {
  const a = await newAccount(call, 'A');
  const ext = (await call('/api/pigeons', { method: 'POST', cookie: a, body: { kind: 'external', ring: 'RO-15-412084', name: 'Fumur', sex: 'M', breederText: 'Crescător X', pedigreeText: 'Super reproducător' } })).data.pigeon;
  const r = await call('/api/pedigrees/import', { method: 'POST', cookie: a, body: { root: { ring: 'RO-15-412084' } } });
  assert.equal(r.status, 201);
  assert.equal(r.data.pigeonId, ext.id);
  const p = (await call(`/api/pigeons/${ext.id}`, { cookie: a })).data.pigeon;
  assert.equal(p.kind, 'own');
  assert.equal(p.name, 'Fumur');
  assert.equal(p.sex, 'M');
  assert.equal(p.breederText, 'Crescător X');
  assert.equal(p.pedigreeText, 'Super reproducător');
});

test('recumpărarea: porumbelul revine fără starea „Vândut”, iar notele cumpărătorului nu sunt înlocuite', async () => {
  const a = await newAccount(call, 'A');
  const b = await newAccount(call, 'B');
  const id = (await call('/api/pigeons', { method: 'POST', cookie: a, body: { kind: 'own', ring: 'RO-20-500500', evaluation: { calitati: 'notele lui A' } } })).data.pigeon.id;
  const t1 = await call(`/api/pigeons/${id}/transfers`, { method: 'POST', cookie: a, body: { email: await emailOf(b), includePrivate: true } });
  const inB = (await call(`/api/transfers/${t1.data.transfer.id}/accept`, { method: 'POST', cookie: b })).data.pigeonId;
  await call(`/api/pigeons/${inB}`, { method: 'PATCH', cookie: b, body: { evaluation: { calitati: 'notele lui B' } } });
  const t2 = await call(`/api/pigeons/${inB}/transfers`, { method: 'POST', cookie: b, body: { email: await emailOf(a), includePrivate: true } });
  const back = await call(`/api/transfers/${t2.data.transfer.id}/accept`, { method: 'POST', cookie: a });
  assert.equal(back.data.pigeonId, id); // același rând de la început
  const p = (await call(`/api/pigeons/${id}`, { cookie: a })).data.pigeon;
  assert.notEqual(p.status, 'vandut');
  assert.equal(p.evaluation.calitati, 'notele lui A');
});

test('vânzătorul își vede vânzările unui porumbel oricâte ar avea în total (?pigeon=)', async () => {
  const a = await newAccount(call, 'A');
  const b = await newAccount(call, 'B');
  const id = (await call('/api/pigeons', { method: 'POST', cookie: a, body: { kind: 'own', ring: 'RO-20-600600' } })).data.pigeon.id;
  await call(`/api/pigeons/${id}/transfers`, { method: 'POST', cookie: a, body: { email: await emailOf(b) } });
  const r = await call(`/api/transfers?pigeon=${id}`, { cookie: a });
  assert.equal(r.data.outgoing.length, 1);
  assert.equal(r.data.outgoing[0].pigeonId, id);
});
