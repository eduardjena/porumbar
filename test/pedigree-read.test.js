import { test, before, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { apiCaller } from './helpers/api.js';
import { startTestApp } from './helpers/db.js';
import { adminCookie, newAccount, setLang } from './helpers/accounts.js';

let server;
let base;
let a;
let reader;
const call = apiCaller(() => ({ base }));
before(async () => {
  process.env.PEDIGREE_READS_PER_DAY = '3';
  ({ server, base } = await startTestApp());
  reader = await import('../src/pedigree-reader.js');
  a = await newAccount(call, 'A'); // citirile sunt incluse în abonament
});
afterEach(() => reader.setPedigreeModel(null));
after(() => server?.close());


const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
const send = (cookie, body) => call('/api/pedigrees/read', { method: 'POST', cookie, body });
const photo = { mime: 'image/png', data: PNG.toString('base64') };

test('poza citită devine arbore: căsuța 1 porumbelul, 2 tatăl, 3 mama, 4 tatăl tatălui', async () => {
  let seen = null;
  reader.setPedigreeModel(async (input) => {
    seen = input;
    return {
      rootSex: 'M',
      notes: 'Partea din dreapta e tăiată.',
      slots: [
        { slot: 1, ring: '412084/15 RO', name: 'FUMUR', color: null, text: null, breeder: null },
        { slot: 2, ring: '898910/09 RO M', name: null, color: 'Pestrit', text: 'Loc 1 National', breeder: null },
        { slot: 3, ring: '1255168/13 RO F', name: null, color: 'Vanata', text: null, breeder: null },
        { slot: 4, ring: '037069/08 RO M', name: null, color: null, text: null, breeder: 'Van Heteren' },
        { slot: 40, ring: 'XX', name: null, color: null, text: null, breeder: null },
      ],
    };
  });
  const r = await send(a, photo);
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(seen.mime, 'image/png');
  assert.ok(Buffer.isBuffer(seen.data));
  const root = r.data.root;
  assert.equal(root.ring, '412084/15 RO');
  assert.equal(root.sex, 'M');
  assert.equal(root.father.ring, '898910/09 RO M');
  assert.equal(root.mother.color, 'Vanata');
  assert.equal(root.father.father.breeder, 'Van Heteren');
  assert.equal(root.mother.father, null);
  assert.equal(r.data.notes, 'Partea din dreapta e tăiată.');
  assert.equal(r.data.filled, 4);
});

test('fără cheia pentru citire: 503 cu un mesaj clar', async () => {
  const key = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  const r = await send(a, photo);
  assert.equal(r.status, 503);
  assert.match(r.data.error, /nu e pornită/);
  if (key) process.env.ANTHROPIC_API_KEY = key;
});

test('fișiere greșite: tip, conținut gol, fără cont', async () => {
  reader.setPedigreeModel(async () => ({ slots: [], rootSex: null, notes: '' }));
  assert.equal((await send(a, { mime: 'text/plain', data: 'YWJj' })).status, 400);
  assert.equal((await send(a, { mime: 'image/png', data: '' })).status, 400);
  assert.equal((await send(null, photo)).status, 401);
});

test('nimic citit: 422, ca omul să încerce altă poză', async () => {
  reader.setPedigreeModel(async () => ({ slots: [], rootSex: null, notes: 'Nu e un pedigree.' }));
  const r = await send(a, photo);
  assert.equal(r.status, 422);
  assert.match(r.data.error, /Nu e un pedigree/);
});

test('limita pe zi: după 3 citiri, a patra e refuzată (429)', async () => {
  // Aici contează doar limita pe zi, nu cea din primele 14 zile de abonament (test/citiri-inceput.test.js).
  process.env.PEDIGREE_READS_FIRST_DAYS = '100';
  try {
    const b = await newAccount(call, 'B');
    reader.setPedigreeModel(async () => ({ slots: [{ slot: 1, ring: 'RO-20-1', name: null, color: null, text: null, breeder: null }], rootSex: null, notes: '' }));
    for (let i = 0; i < 3; i++) assert.equal((await send(b, photo)).status, 200);
    const r = await send(b, photo);
    assert.equal(r.status, 429);
    assert.match(r.data.error, /mâine/);
  } finally {
    delete process.env.PEDIGREE_READS_FIRST_DAYS;
  }
});

// ——— Inelele japoneze fără „JPN” de pe o fișă citită din poză ———

test('cont ja: inelele japoneze citite din poză se salvează ca JP; cele doar din cifre, cum sunt; la ro, ca azi', async () => {
  reader.setPedigreeModel(async () => ({
    rootSex: 'M',
    notes: null,
    slots: [
      { slot: 1, ring: '25-AB-01234', name: 'Kaze', color: null, text: null, breeder: null },
      { slot: 2, ring: '26-800546', name: null, color: null, text: null, breeder: null },
      { slot: 3, ring: '24-EF-00555', name: null, color: null, text: null, breeder: null },
    ],
  }));
  const pigeon = async (cookie, id) => (await call(`/api/pigeons/${id}`, { cookie })).data.pigeon;
  const readAndImport = async (cookie) => {
    const r = await send(cookie, photo);
    assert.equal(r.status, 200, JSON.stringify(r.data));
    const imp = await call('/api/pedigrees/import', { method: 'POST', cookie, body: { root: r.data.root } });
    assert.equal(imp.status, 201, JSON.stringify(imp.data));
    const root = await pigeon(cookie, imp.data.pigeonId);
    return { unclear: r.data.unclear, root, father: await pigeon(cookie, root.fatherId), mother: await pigeon(cookie, root.motherId) };
  };

  const ja = await newAccount(call, 'Ja');
  await setLang(call, (await call('/api/auth/me', { cookie: ja })).data.account.id, 'ja');
  const j = await readAndImport(ja);
  assert.equal(j.unclear, 1, 'doar inelul fără țară, din cifre');
  assert.equal(j.root.ring.raw, 'JPN 25-AB-01234');
  assert.equal(j.root.ring.display, 'JPN 25-AB-01234');
  assert.equal(j.father.ring.raw, '26-800546');
  assert.equal(j.mother.ring.raw, 'JPN 24-EF-00555');
  assert.equal(j.mother.ring.display, 'JPN 24-EF-00555');

  const ro = await newAccount(call, 'Ro');
  const r = await readAndImport(ro);
  assert.equal(r.unclear, 3);
  assert.equal(r.root.ring.raw, '25-AB-01234');
  assert.equal(r.root.ring.country, null);
  assert.equal(r.mother.ring.raw, '24-EF-00555');
});

test('instrucțiunile cunosc fișa japoneză: titlul, părinții, crescătorul, semnele de sex și inelul cu / fără JPN', () => {
  const text = reader.instructionsFor('ro');
  for (const token of ['血統書', '父', '母', '作出者', '♂', '♀', 'JPN 25-AB-01234', '25-AB-01234']) {
    assert.ok(text.includes(token), `lipsește ${token}`);
  }
});
