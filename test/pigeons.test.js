import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { apiCaller } from './helpers/api.js';
import { startTestApp } from './helpers/db.js';
import { newAccount, setLang } from './helpers/accounts.js';

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

const create = (cookie, body) => call('/api/pigeons', { method: 'POST', cookie, body });
let first;

test('porumbel propriu: inelul se recunoaște, sexul vine din inel', async () => {
  const r = await create(a, { kind: 'own', ring: 'RO-26-800546 L', name: 'DE 546', color: 'albastru', status: 'tanar', lines: ['Popescu', ' popescu ', 'Van Heteren'] });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  first = r.data.pigeon;
  assert.equal(first.sex, 'M');
  assert.equal(first.ring.display, 'RO-26-800546');
  assert.equal(first.ring.raw, 'RO-26-800546 L');
  assert.equal(first.breed, 'voiajor');
  assert.deepEqual(first.lines, ['Popescu', 'Van Heteren']);
});

test('același inel în altă formă e dublură (Review Focus 1)', async () => {
  const r = await create(a, { kind: 'own', ring: '800546/26 RO' });
  assert.equal(r.status, 409);
  assert.equal(r.data.error, 'Inelul RO-26-800546 este deja în porumbarul tău.');
  // Separare totală: alt cont poate avea același inel și nu află nimic despre primul.
  const other = await create(b, { kind: 'own', ring: 'RO 26 0800546' });
  assert.equal(other.status, 201);
  assert.notEqual(other.data.pigeon.id, first.id);
  assert.equal((await call(`/api/pigeons/${first.id}`, { cookie: b })).status, 404);
  const mine = await call('/api/pigeons?q=800546', { cookie: b });
  assert.deepEqual(mine.data.pigeons.map((p) => p.id), [other.data.pigeon.id]);
});

test('căutarea după inel în altă formă și după nume', async () => {
  const byRing = await call('/api/pigeons?q=0800546', { cookie: a });
  assert.deepEqual(byRing.data.pigeons.map((p) => p.id), [first.id]);
  const byForm = await call(`/api/pigeons?q=${encodeURIComponent('800546/26 RO')}`, { cookie: a });
  assert.deepEqual(byForm.data.pigeons.map((p) => p.id), [first.id]);
  const byName = await call('/api/pigeons?q=de%20546', { cookie: a });
  assert.deepEqual(byName.data.pigeons.map((p) => p.id), [first.id]);
  assert.ok(!(await call('/api/pigeons?q=800546', { cookie: b })).data.pigeons.some((p) => p.id === first.id));
});

test('strămoși fără inel și cu inel necitit (Review Focus 2)', async () => {
  const x = await create(a, { kind: 'external', ring: '000 M', breederText: 'Govaerts, pedigreu distrus' });
  const y = await create(a, { kind: 'external', ring: '0000/07 RO M', colorText: 'Vanat', pedigreeText: 'A fost neinelat' });
  assert.equal(x.status, 201, JSON.stringify(x.data));
  assert.equal(y.status, 201, JSON.stringify(y.data));
  assert.equal(x.data.pigeon.sex, 'M');
  const z = await create(a, { kind: 'external', ring: 'Latebred BasVK??' });
  assert.equal(z.status, 201);
  assert.equal(z.data.pigeon.ring.display, 'Latebred BasVK??');
  // Un porumbel propriu fără inel tot nu se poate salva.
  const own = await create(a, { kind: 'own', ring: '000' });
  assert.equal(own.status, 400);
  assert.equal(own.data.error, 'Inelul nu poate fi citit. Scrie-l ca în exemplu: RO-25-123456.');
});

test('plasa de siguranță: un porumbel propriu cu inel nerecunoscut se salvează cum a fost scris (design inele-lume)', async () => {
  const c = await newAccount(call, 'Plasa');
  const own = await create(c, { kind: 'own', ring: 'Latebred BasVK 7' });
  assert.equal(own.status, 201, JSON.stringify(own.data));
  assert.equal(own.data.pigeon.ring.raw, 'Latebred BasVK 7');
  assert.equal(own.data.pigeon.ring.display, 'Latebred BasVK 7');
  assert.equal(own.data.pigeon.ring.country, null);
  // Aceeași scriere, cu alți separatori și litere mici: dublură.
  const dup = await create(c, { kind: 'own', ring: 'latebred-basvk-7' });
  assert.equal(dup.status, 409);
  assert.equal(dup.data.error, 'Inelul latebred-basvk-7 este deja în porumbarul tău.');
  // Căutarea îl găsește și după scrierea curățată, și după o bucată din text.
  for (const q of ['LATEBRED BASVK 7', 'basvk']) {
    const found = await call(`/api/pigeons?q=${encodeURIComponent(q)}`, { cookie: c });
    assert.deepEqual(found.data.pigeons.map((p) => p.id), [own.data.pigeon.id], q);
  }
  // Ca strămoș, același text rămâne un porumbel separat, fără cheie (ca înainte): nu se leagă singur.
  assert.equal((await create(c, { kind: 'external', ring: 'Latebred BasVK 7' })).status, 201);
  assert.equal((await create(c, { kind: 'external', ring: 'Latebred BasVK 7' })).status, 201);
  // Inelele noi din lume se recunosc: GB cu literă de serie, AU (SUA) cu club.
  const gb = await create(c, { kind: 'own', ring: 'GB22T12345 HEN' });
  assert.equal(gb.status, 201, JSON.stringify(gb.data));
  assert.equal(gb.data.pigeon.ring.display, 'GB-22-T-12345');
  assert.equal(gb.data.pigeon.sex, 'F');
  assert.equal((await create(c, { kind: 'own', ring: 'GB-2022-T-12345' })).status, 409);
  assert.equal((await create(c, { kind: 'own', ring: '25138 RMR AU 2025' })).data.pigeon.ring.display, 'AU-25-RMR-25138');
  // Fără nicio literă sau cifră nu e un inel.
  for (const ring of ['??', '-', '♂']) {
    const none = await create(c, { kind: 'own', ring });
    assert.equal(none.status, 400, ring);
    assert.equal(none.data.error, 'Inelul nu poate fi citit. Scrie-l ca în exemplu: RO-25-123456.', ring);
  }
  // Inelul maghiar fără organizator rămâne refuzat, și cu sexul scris în cuvinte.
  for (const ring of ['HU-23-14530 tojó', 'HUNGARY 2023 14530']) assert.equal((await create(c, { kind: 'own', ring })).status, 400, ring);
  const hu = await create(c, { kind: 'own', ring: 'HU-23-14530' });
  assert.equal(hu.status, 400);
  assert.match(hu.data.error, /numărul asociației/);
  // Lista arată inelul nerecunoscut cum a fost scris.
  const list = await call('/api/pigeons?kind=own', { cookie: c });
  assert.ok(list.data.pigeons.some((p) => p.ring?.display === 'Latebred BasVK 7'));
  // Căutarea după inel (fișa de pedigree): același text găsește porumbelul propriu.
  const look = await call(`/api/pigeons/lookup?ring=${encodeURIComponent('LATEBRED BASVK 7')}`, { cookie: c });
  assert.ok(look.data.matches.some((m) => m.pigeon.id === own.data.pigeon.id));
});

test('strămoș extern dublat în același cont', async () => {
  assert.equal((await create(a, { kind: 'external', ring: 'NL-11-1724956' })).status, 201);
  const dup = await create(a, { kind: 'external', ring: '1724956/11 NL' });
  assert.equal(dup.status, 409);
  assert.equal((await create(b, { kind: 'external', ring: 'NL-11-1724956' })).status, 201, 'alt cont își are strămoșii lui');
});

test('valori invalide', async () => {
  assert.equal((await create(a, { kind: 'own', ring: 'RO-25-1', color: 'inexistent' })).status, 400);
  assert.equal((await create(a, { kind: 'own', ring: 'RO-25-2', evaluation: { scores: { echilibru: 6 } } })).status, 400);
  assert.equal((await create(a, { kind: 'own', ring: 'RO-25-3', evaluation: { scores: { inventat: 3 } } })).status, 400);
  assert.equal((await create(a, { kind: 'own', ring: 'RO-25-4', hatchedOn: '2025-13-40' })).status, 400);
  assert.equal((await create(a, { kind: 'altceva', ring: 'RO-25-5' })).status, 400);
});

test('evaluarea se salvează', async () => {
  const r = await call(`/api/pigeons/${first.id}`, {
    method: 'PATCH',
    cookie: a,
    body: { evaluation: { scores: { echilibru: 5, aripa: 4 }, calitati: 'Musculatură bună', deDorit: '', defecte: 'Ochi deschis' } },
  });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.deepEqual(r.data.pigeon.evaluation.scores, { echilibru: 5, aripa: 4 });
  assert.equal(r.data.pigeon.evaluation.calitati, 'Musculatură bună');
  assert.equal(r.data.pigeon.name, 'DE 546', 'câmpurile netrimise rămân');
});

test('alt cont nu vede porumbelul (Review Focus 4)', async () => {
  assert.equal((await call(`/api/pigeons/${first.id}`, { cookie: b })).status, 404);
  assert.equal((await call(`/api/pigeons/${first.id}`, { method: 'PATCH', cookie: b, body: { name: 'x' } })).status, 404);
  assert.equal((await call(`/api/pigeons/${first.id}`, { method: 'DELETE', cookie: b })).status, 404);
  assert.equal((await call(`/api/pigeons/${first.id}`, { auth: 'none' })).status, 401);
});

test('filtrele listei', async () => {
  const r = await call('/api/pigeons?kind=own&sex=M&year=2026', { cookie: a });
  assert.deepEqual(r.data.pigeons.map((p) => p.id), [first.id]);
  assert.ok((await call('/api/pigeons?kind=external', { cookie: a })).data.pigeons.every((p) => p.kind === 'external'));
});

test('un porumbel care e părinte nu se șterge', async () => {
  const child = await create(a, { kind: 'own', ring: 'RO-26-900001' });
  const { run } = await import('../src/db.js');
  await run('UPDATE pigeons SET father_id = ? WHERE id = ?', first.id, child.data.pigeon.id);
  const del = await call(`/api/pigeons/${first.id}`, { method: 'DELETE', cookie: a });
  assert.equal(del.status, 409);
  assert.equal(del.data.error, 'Porumbelul are pui în program. Schimbă-i starea în loc să-l ștergi.');
  assert.equal((await call(`/api/pigeons/${child.data.pigeon.id}`, { method: 'DELETE', cookie: a })).status, 204);
});

// ——— Inelele japoneze fără „JPN” (25-AB-01234): doar la conturile japoneze ———

async function langAccount(name, lang) {
  const cookie = await newAccount(call, name);
  await setLang(call, (await call('/api/auth/me', { cookie })).data.account.id, lang);
  return cookie;
}

test('cont ja: inelul japonez fără prefix devine JP (textul omului, cu JPN în față)', async () => {
  const ja = await langAccount('Ja', 'ja');
  const r = await create(ja, { kind: 'own', ring: '25-AB-01234' });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  assert.equal(r.data.pigeon.ring.display, 'JPN 25-AB-01234');
  assert.equal(r.data.pigeon.ring.raw, 'JPN 25-AB-01234');
  // Același inel scris altfel e o dublură.
  assert.equal((await create(ja, { kind: 'own', ring: '25AB01234' })).status, 409);
  // Schimbat din fișă: tot JP.
  const p = await call(`/api/pigeons/${r.data.pigeon.id}`, { method: 'PATCH', cookie: ja, body: { ring: '2025 AB 01235' } });
  assert.equal(p.status, 200, JSON.stringify(p.data));
  assert.equal(p.data.pigeon.ring.raw, 'JPN 2025 AB 01235');
  assert.equal(p.data.pigeon.ring.display, 'JPN 25-AB-01235');
});

test('cont ja: un inel doar din cifre se salvează exact cum l-a scris omul (Review Focus 2)', async () => {
  const ja = await langAccount('Ja', 'ja');
  for (const ring of ['26-800546', '412084/15']) {
    const r = await create(ja, { kind: 'own', ring });
    assert.equal(r.status, 201, JSON.stringify(r.data));
    assert.equal(r.data.pigeon.ring.raw, ring);
  }
});

test('cont ro: 25-AB-01234 se salvează ca azi, fără JPN (Review Focus 1)', async () => {
  const ro = await langAccount('Ro', 'ro');
  const r = await create(ro, { kind: 'own', ring: '25-AB-01234' });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  assert.equal(r.data.pigeon.ring.raw, '25-AB-01234');
  assert.equal(r.data.pigeon.ring.country, null);
  const hu = await langAccount('Hu', 'hu');
  assert.equal((await create(hu, { kind: 'external', ring: '25-AB-01234' })).data.pigeon.ring.raw, '25-AB-01234');
});
