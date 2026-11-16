import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { apiCaller } from './helpers/api.js';
import { startTestApp } from './helpers/db.js';
import { newAccount } from './helpers/accounts.js';

let server;
let base;
let a;
let b;
let pigeon;
const call = apiCaller(() => ({ base }));
before(async () => {
  ({ server, base } = await startTestApp());
  a = await newAccount(call, 'A');
  b = await newAccount(call, 'B');
  pigeon = (await call('/api/pigeons', { method: 'POST', cookie: a, body: { kind: 'own', ring: 'RO-25-123456' } })).data.pigeon;
});
after(() => server?.close());

test('jurnalul', async () => {
  const add = await call(`/api/pigeons/${pigeon.id}/journal`, { method: 'POST', cookie: a, body: { date: '2026-03-01', type: 'vaccin', text: 'Paramixo' } });
  assert.equal(add.status, 201, JSON.stringify(add.data));
  await call(`/api/pigeons/${pigeon.id}/journal`, { method: 'POST', cookie: a, body: { date: '2026-04-01', type: 'nota', text: 'Formă bună' } });
  const list = await call(`/api/pigeons/${pigeon.id}/journal`, { cookie: a });
  assert.deepEqual(list.data.entries.map((e) => e.type), ['nota', 'vaccin'], 'cele mai noi întâi');
  assert.equal((await call(`/api/pigeons/${pigeon.id}/journal`, { method: 'POST', cookie: a, body: { date: '2026-04-01', type: 'inventat', text: 'x' } })).status, 400);
  assert.equal((await call(`/api/pigeons/${pigeon.id}/journal`, { method: 'POST', cookie: a, body: { date: 'ieri', type: 'nota', text: 'x' } })).status, 400);
  assert.equal((await call(`/api/journal/${add.data.entry.id}`, { method: 'DELETE', cookie: b })).status, 404);
  assert.equal((await call(`/api/journal/${add.data.entry.id}`, { method: 'DELETE', cookie: a })).status, 204);
  assert.equal((await call(`/api/pigeons/${pigeon.id}/journal`, { cookie: a })).data.entries.length, 1);
});

test('alt cont nu vede jurnalul', async () => {
  assert.equal((await call(`/api/pigeons/${pigeon.id}/journal`, { cookie: b })).status, 404);
  assert.equal((await call(`/api/pigeons/${pigeon.id}/journal`, { method: 'POST', cookie: b, body: { date: '2026-04-01', type: 'nota', text: 'x' } })).status, 404);
});

test('pozele nu mai există pe server (cerut de utilizator: fără spațiu pentru poze)', async () => {
  const png = Buffer.from('89504e470d0a1a0a0000000d4948445200000001', 'hex');
  const up = await call(`/api/pigeons/${pigeon.id}/photos?kind=corp`, { method: 'POST', cookie: a, raw: png, headers: { 'Content-Type': 'image/png' } });
  assert.equal(up.status, 415, 'încărcarea unei poze e refuzată ca orice cerere care nu e JSON');
  assert.equal((await call(`/api/pigeons/${pigeon.id}/photos`, { cookie: a })).status, 404);
  const { one } = await import('../src/db.js');
  assert.equal((await one(`SELECT to_regclass('photos') AS t`)).t, null, 'tabelul pozelor a fost șters');
});
