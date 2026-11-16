import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
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

// Un PNG de 1×1 pixel.
const PNG = Buffer.from(
  '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360000002000154a24f5d0000000049454e44ae426082',
  'hex',
);
const upload = (cookie, buf, type = 'image/png', kind = 'corp', id = pigeon.id) =>
  call(`/api/pigeons/${id}/photos?kind=${kind}`, { method: 'POST', cookie, raw: buf, headers: { 'Content-Type': type } });

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

test('pozele', async () => {
  const r = await upload(a, PNG);
  assert.equal(r.status, 201, JSON.stringify(r.data));
  assert.equal(r.data.photo.kind, 'corp');
  const got = await call(r.data.photo.url, { cookie: a });
  assert.equal(got.status, 200);
  assert.ok(got.buf.equals(PNG));
  assert.equal(got.res.headers.get('content-type'), 'image/png');
  assert.equal((await call(`/api/pigeons/${pigeon.id}/photos`, { cookie: a })).data.photos.length, 1);
  assert.equal((await upload(a, Buffer.from('nu e poză'))).status, 415, 'conținutul nu e imagine');
  assert.equal((await upload(a, PNG, 'image/png', 'inventat')).status, 400);
  assert.equal((await upload(a, Buffer.alloc(11 * 1024 * 1024, 1))).status, 413);
});

test('alt cont nu vede jurnalul și pozele (Review Focus 4)', async () => {
  const photo = (await upload(a, PNG, 'image/png', 'aripa')).data.photo;
  assert.equal((await call(`/api/pigeons/${pigeon.id}/journal`, { cookie: b })).status, 404);
  assert.equal((await call(`/api/pigeons/${pigeon.id}/journal`, { method: 'POST', cookie: b, body: { date: '2026-04-01', type: 'nota', text: 'x' } })).status, 404);
  assert.equal((await call(`/api/pigeons/${pigeon.id}/photos`, { cookie: b })).status, 404);
  assert.equal((await upload(b, PNG)).status, 404);
  assert.equal((await call(photo.url, { cookie: b })).status, 404);
  assert.equal((await call(photo.url, { method: 'DELETE', cookie: b })).status, 404);
  assert.equal((await call(photo.url, { auth: 'none' })).status, 401);
});

test('ștergerea pozei, a porumbelului și a contului șterge fișierele', async () => {
  const dir = path.join(process.env.DATA_DIR, 'photos');
  const p1 = (await upload(a, PNG)).data.photo;
  assert.ok(fs.existsSync(path.join(dir, String(p1.id))));
  assert.equal((await call(p1.url, { method: 'DELETE', cookie: a })).status, 204);
  assert.ok(!fs.existsSync(path.join(dir, String(p1.id))));

  const other = (await call('/api/pigeons', { method: 'POST', cookie: a, body: { kind: 'own', ring: 'RO-25-654321' } })).data.pigeon;
  const p2 = (await upload(a, PNG, 'image/png', 'ochi', other.id)).data.photo;
  assert.equal((await call(`/api/pigeons/${other.id}`, { method: 'DELETE', cookie: a })).status, 204);
  assert.ok(!fs.existsSync(path.join(dir, String(p2.id))));

  const remaining = (await call(`/api/pigeons/${pigeon.id}/photos`, { cookie: a })).data.photos;
  assert.ok(remaining.length > 0);
  assert.equal((await call('/api/auth/me', { method: 'DELETE', cookie: a, body: { password: 'parola-de-test-123' } })).status, 204);
  for (const p of remaining) assert.ok(!fs.existsSync(path.join(dir, String(p.id))));
});
