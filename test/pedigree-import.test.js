import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { apiCaller } from './helpers/api.js';
import { startTestApp } from './helpers/db.js';
import { newAccount } from './helpers/accounts.js';
import { PEDIGREE_FOTO } from './fixtures/pedigree-foto.js';

let server;
let base;
let a;
let b;
const call = apiCaller(() => ({ base }));
before(async () => {
  ({ server, base } = await startTestApp());
  a = await newAccount(call, 'A');
  b = await newAccount(call, 'B');
});
after(() => server?.close());

const importPedigree = (cookie, root, rootKind = 'own') => call('/api/pedigrees/import', { method: 'POST', cookie, body: { root, rootKind } });

/** Toate inelele din arbore, cu id-ul fiecărei apariții. */
async function treeRings(cookie, id) {
  const t = (await call(`/api/pigeons/${id}/tree?generations=4`, { cookie })).data;
  const out = [];
  const walk = (n) => {
    if (!n) return;
    out.push({ ring: t.pigeons[n.id].ring?.display ?? null, id: n.id });
    walk(n.father);
    walk(n.mother);
  };
  walk(t.tree);
  return out;
}

test('pedigree-ul foto dintr-un singur pas: 31 de căsuțe, strămoșii repetați sunt același porumbel', async () => {
  const r = await importPedigree(a, PEDIGREE_FOTO);
  assert.equal(r.status, 201, JSON.stringify(r.data));
  const rings = await treeRings(a, r.data.pigeonId);
  assert.equal(rings.length, 31);
  const de746 = rings.filter((x) => x.ring === 'NL-04-1954746');
  assert.equal(de746.length, 3);
  assert.equal(new Set(de746.map((x) => x.id)).size, 1);
  const root = (await call(`/api/pigeons/${r.data.pigeonId}`, { cookie: a })).data.pigeon;
  assert.equal(root.kind, 'own');
  assert.equal(root.pedigreeText, 'FUMUR');
  // Tatăl e mascul, mama femelă, după locul din pedigree.
  const father = (await call(`/api/pigeons/${root.fatherId}`, { cookie: a })).data.pigeon;
  const mother = (await call(`/api/pigeons/${root.motherId}`, { cookie: a })).data.pigeon;
  assert.equal(father.sex, 'M');
  assert.equal(mother.sex, 'F');
  assert.equal(father.kind, 'external');
  assert.ok(r.data.created >= 25);
});

test('al doilea import al aceluiași pedigree nu dublează nimic', async () => {
  const first = await importPedigree(a, PEDIGREE_FOTO);
  const before = (await call('/api/pigeons?kind=external', { cookie: a })).data.pigeons.length;
  const again = await importPedigree(a, PEDIGREE_FOTO);
  assert.equal(again.status, 201);
  assert.equal(again.data.pigeonId, first.data.pigeonId);
  assert.equal(again.data.created, 0);
  const after = (await call('/api/pigeons?kind=external', { cookie: a })).data.pigeons.length;
  assert.equal(after, before);
});

test('un strămoș deja în cont cu alt tată: legătura existentă rămâne, diferența e raportată', async () => {
  const root = { ring: 'RO-20-111111', father: { ring: 'RO-18-222222', father: { ring: 'RO-15-333333' } } };
  assert.equal((await importPedigree(b, root)).status, 201);
  const other = { ring: 'RO-21-444444', father: { ring: 'RO-18-222222', father: { ring: 'RO-15-555555' } } };
  const r = await importPedigree(b, other);
  assert.equal(r.status, 201);
  assert.equal(r.data.conflicts.length, 1);
  assert.match(r.data.conflicts[0].message, /RO-18-222222/);
  const sire = (await call(`/api/pigeons/lookup?ring=RO-18-222222`, { cookie: b })).data.matches[0].pigeon;
  const full = (await call(`/api/pigeons/${sire.id}`, { cookie: b })).data.pigeon;
  const grand = (await call(`/api/pigeons/${full.fatherId}`, { cookie: b })).data.pigeon;
  assert.equal(grand.ring.display, 'RO-15-333333');
});

test('fiecare cont are copiile lui: importul din B nu atinge porumbeii lui A', async () => {
  const ra = await importPedigree(a, PEDIGREE_FOTO);
  const rb = await importPedigree(b, PEDIGREE_FOTO);
  assert.equal(rb.status, 201);
  assert.notEqual(rb.data.pigeonId, ra.data.pigeonId);
  assert.equal((await call(`/api/pigeons/${ra.data.pigeonId}`, { cookie: b })).status, 404);
});

test('strămoș de împrumut: rădăcina poate fi „din alt porumbar”', async () => {
  const r = await importPedigree(b, { ring: 'BE-22-765432', father: { ring: 'BE-19-111222' } }, 'external');
  assert.equal(r.status, 201);
  assert.equal((await call(`/api/pigeons/${r.data.pigeonId}`, { cookie: b })).data.pigeon.kind, 'external');
});

test('date greșite: inelul porumbelului propriu, prea multe generații, fără cont', async () => {
  assert.equal((await importPedigree(a, { ring: '000' })).status, 400, 'porumbelul propriu are inel');
  assert.equal((await importPedigree(a, { ring: 'HU-23-14530' })).status, 400, 'maghiar fără organizator');
  let deep = { ring: 'RO-10-100000' };
  for (let i = 1; i <= 6; i++) deep = { ring: `RO-1${i % 10}-10000${i}`, father: deep };
  assert.equal((await importPedigree(a, deep)).status, 400);
  assert.equal((await importPedigree(null, PEDIGREE_FOTO)).status, 401);
  assert.equal((await importPedigree(a, { ring: 'RO-20-999999', father: { ring: 'RO-20-999999' } })).status, 400);
});

test('rădăcina proprie cu inel nerecunoscut se păstrează cum e scrisă; importul repetat nu o dublează', async () => {
  const c = await newAccount(call, 'Plasa import');
  const paper = { ring: 'Latebred BasVK 7', father: { ring: 'XYZ tata' }, mother: { ring: 'RO-20-123123' } };
  const first = await importPedigree(c, paper);
  assert.equal(first.status, 201, JSON.stringify(first.data));
  assert.equal(first.data.rootWas, 'created');
  const again = await importPedigree(c, { ...paper, ring: 'LATEBRED-BASVK-7' });
  assert.equal(again.status, 201, JSON.stringify(again.data));
  assert.equal(again.data.pigeonId, first.data.pigeonId);
  assert.equal(again.data.rootWas, 'existing');
  // Strămoșul cu inel nerecunoscut rămâne „ca înainte”: nu se leagă singur de alt porumbel, dar nici nu se dublează pe
  // porumbelul deja legat (tatăl existent se completează).
  const rings = (await treeRings(c, first.data.pigeonId)).map((x) => x.ring);
  assert.deepEqual(rings, ['Latebred BasVK 7', 'XYZ tata', 'RO-20-123123']);
});

test('fișa japoneză citită din poză: la contul ja inel JPN … și culoarea cu textul păstrat; la ro inelul cum e scris', async () => {
  const { setLang } = await import('./helpers/accounts.js');
  const node = { ring: '25-AB-01234', color: 'B' };
  const ja = await newAccount(call, 'JA');
  await setLang(call, (await call('/api/auth/me', { cookie: ja })).data.account.id, 'ja');
  const r = await importPedigree(ja, node);
  assert.equal(r.status, 201, JSON.stringify(r.data));
  const p = (await call(`/api/pigeons/${r.data.pigeonId}`, { cookie: ja })).data.pigeon;
  assert.equal(p.ring.display, 'JPN 25-AB-01234');
  assert.equal(p.color ?? null, null);
  assert.equal(p.colorText, 'B');
  const ro = await newAccount(call, 'RO');
  const r2 = await importPedigree(ro, node);
  assert.equal(r2.status, 201, JSON.stringify(r2.data));
  const q = (await call(`/api/pigeons/${r2.data.pigeonId}`, { cookie: ro })).data.pigeon;
  assert.equal(q.ring.raw, '25-AB-01234');
});
