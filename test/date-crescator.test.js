import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { apiCaller } from './helpers/api.js';
import { startTestApp } from './helpers/db.js';
import { adminCookie } from './helpers/accounts.js';

// Jos în stânga pe fișă: numele de pe fișă, adresa, telefonul, emailul. La crescători le pune vânzătorul
// (test/date-pe-fisa.test.js); vânzătorul (adminul) și le schimbă singur pe ale lui, din Cont.
let server;
let base;
let admin;
const call = apiCaller(() => ({ base }));
before(async () => {
  ({ server, base } = await startTestApp());
  admin = await adminCookie(call);
});
after(() => server?.close());

test('adminul își schimbă singur numele de pe fișă, telefonul și adresa; textul prea lung e refuzat', async () => {
  const r = await call('/api/auth/me', { method: 'PATCH', cookie: admin, body: { pedigreeName: '  Porumbar Team ', phone: '0700 000 000', address: 'Str. Exemplu 1' } });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.account.pedigreeName, 'Porumbar Team');
  assert.equal(r.data.account.phone, '0700 000 000');
  const pigeon = (await call('/api/pigeons', { method: 'POST', cookie: admin, body: { kind: 'own', ring: 'RO-26-800546' } })).data.pigeon;
  const ped = (await call(`/api/pigeons/${pigeon.id}/pedigree`, { cookie: admin })).data;
  assert.equal(ped.owner.name, 'Porumbar Team');
  assert.equal(ped.owner.phone, '0700 000 000');
  assert.equal((await call('/api/auth/me', { method: 'PATCH', cookie: admin, body: { pedigreeName: 'x'.repeat(121) } })).status, 400);
  assert.equal((await call('/api/auth/me', { method: 'PATCH', cookie: admin, body: { pedigreeName: 7 } })).status, 400);
});
