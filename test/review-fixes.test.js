// Testele pentru problemele găsite la recenzia finală a Planului 1.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { apiCaller } from './helpers/api.js';
import { startTestApp } from './helpers/db.js';
import { newAccount } from './helpers/accounts.js';

let server;
let base;
let a;
const call = apiCaller(() => ({ base }));
before(async () => {
  ({ server, base } = await startTestApp());
  a = await newAccount(call, 'A');
});
after(() => server?.close());

const post = (body, cookie = a) => call('/api/pigeons', { method: 'POST', cookie, body });

test('căutarea unui strămoș fără inel nu propune alt „000 M” (Important 1)', async () => {
  assert.equal((await post({ kind: 'external', ring: '000 M', breederText: 'Govaerts' })).status, 201);
  const r = await call(`/api/pigeons/lookup?ring=${encodeURIComponent('000 M')}`, { cookie: a });
  assert.equal(r.status, 200);
  assert.equal(r.data.ring.unringed, true);
  assert.deepEqual(r.data.matches, []);
});

test('inelul unui strămoș devenit porumbel propriu: același rând, cu legăturile lui (Important 3)', async () => {
  const ext = (await post({ kind: 'external', ring: 'RO-20-111111', name: 'Tata cumpărat' })).data.pigeon;
  const child = (await post({ kind: 'own', ring: 'RO-24-222222' })).data.pigeon;
  assert.equal((await call(`/api/pigeons/${child.id}/parents`, { method: 'PUT', cookie: a, body: { fatherId: ext.id, motherId: null } })).status, 200);

  const own = await post({ kind: 'own', ring: '111111/20 RO', status: 'reproducator' });
  assert.equal(own.status, 201, JSON.stringify(own.data));
  assert.equal(own.data.pigeon.id, ext.id, 'același porumbel, nu unul nou');
  assert.equal(own.data.pigeon.kind, 'own');
  assert.equal(own.data.pigeon.status, 'reproducator');
  assert.equal(own.data.pigeon.name, 'Tata cumpărat', 'câmpurile netrimise rămân');
  const look = await call('/api/pigeons/lookup?ring=RO-20-111111', { cookie: a });
  assert.equal(look.data.matches.length, 1);
  assert.equal(look.data.matches[0].offspringCount, 1);
});

test('un cookie străin stricat nu blochează contul (Important, cookie)', async () => {
  const r = await call('/api/auth/me', { cookie: `altcookie=%E0%A4%A; ${a}` });
  assert.equal(r.status, 200);
});
