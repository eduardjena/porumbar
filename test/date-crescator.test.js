import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { apiCaller } from './helpers/api.js';
import { startTestApp } from './helpers/db.js';
import { newAccount } from './helpers/accounts.js';

// Jos în stânga pe fișa tipărită: numele de pe pedigree (echipa / crescătoria), adresa, telefonul, emailul.
let server;
let base;
let a;
let pigeon;
const call = apiCaller(() => ({ base }));
before(async () => {
  ({ server, base } = await startTestApp());
  a = await newAccount(call, 'A');
  pigeon = (await call('/api/pigeons', { method: 'POST', cookie: a, body: { kind: 'own', ring: 'RO-26-800546' } })).data.pigeon;
});
after(() => server?.close());

test('numele de pe pedigree se salvează în cont și apare pe pedigree în locul numelui contului', async () => {
  const r = await call('/api/auth/me', { method: 'PATCH', cookie: a, body: { pedigreeName: '  Popescu-Ionescu Team ' } });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.account.pedigreeName, 'Popescu-Ionescu Team');
  assert.equal((await call('/api/auth/me', { cookie: a })).data.account.pedigreeName, 'Popescu-Ionescu Team');
  const ped = (await call(`/api/pigeons/${pigeon.id}/pedigree`, { cookie: a })).data;
  assert.equal(ped.owner.name, 'Popescu-Ionescu Team');
});

test('fără nume de pedigree rămâne numele contului; textul prea lung e refuzat', async () => {
  await call('/api/auth/me', { method: 'PATCH', cookie: a, body: { pedigreeName: '' } });
  const me = (await call('/api/auth/me', { cookie: a })).data.account;
  assert.equal(me.pedigreeName, null);
  assert.equal((await call(`/api/pigeons/${pigeon.id}/pedigree`, { cookie: a })).data.owner.name, me.name);
  assert.equal((await call('/api/auth/me', { method: 'PATCH', cookie: a, body: { pedigreeName: 'x'.repeat(121) } })).status, 400);
  assert.equal((await call('/api/auth/me', { method: 'PATCH', cookie: a, body: { pedigreeName: 7 } })).status, 400);
});
