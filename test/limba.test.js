import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { apiCaller } from './helpers/api.js';
import { startTestApp } from './helpers/db.js';
import { adminCookie, newAccount, setLang } from './helpers/accounts.js';
import { LANGS, t } from '../src/i18n.js';

// O limbă „în probă” (nepublică) o pune doar vânzătorul, până o verifică cineva. Maghiara e publică din 2026-11-20;
// aici o facem din nou „în probă”, ca să rămână verificat felul în care merge o limbă nouă, încă neverificată.
let server;
let base;
let admin;
const call = apiCaller(() => ({ base }));
const me = async (cookie) => (await call('/api/auth/me', { cookie })).data.account;
const hu = LANGS.find((l) => l.code === 'hu');
before(async () => {
  hu.public = false;
  ({ server, base } = await startTestApp());
  admin = await adminCookie(call);
});
after(() => {
  hu.public = true;
  server?.close();
});

test('un cont nou e în română', async () => {
  const a = await newAccount(call, 'Ion');
  assert.equal((await me(a)).lang, 'ro');
});

test('vânzătorul pune maghiara; omul poate trece în română, dar nu se mai poate întoarce singur', async () => {
  const a = await newAccount(call, 'Sándor');
  const id = (await me(a)).id;
  await setLang(call, id, 'hu');
  assert.equal((await me(a)).lang, 'hu');
  assert.equal((await call(`/api/admin/accounts/${id}`, { cookie: admin })).data.account.lang, 'hu');
  assert.equal((await call('/api/auth/me', { method: 'PATCH', cookie: a, body: { lang: 'hu' } })).status, 200, 'rămâne în limba lui');
  assert.equal((await call('/api/auth/me', { method: 'PATCH', cookie: a, body: { lang: 'ro' } })).status, 200);
  assert.equal((await me(a)).lang, 'ro');
  assert.equal((await call('/api/auth/me', { method: 'PATCH', cookie: a, body: { lang: 'hu' } })).status, 403);
  await setLang(call, id, 'hu');
  assert.equal((await me(a)).lang, 'hu');
});

test('un cont în română nu-și poate pune singur o limbă în probă; o limbă necunoscută e refuzată', async () => {
  const a = await newAccount(call, 'Vasile');
  assert.equal((await call('/api/auth/me', { method: 'PATCH', cookie: a, body: { lang: 'hu' } })).status, 403);
  assert.equal((await call('/api/auth/me', { method: 'PATCH', cookie: a, body: { lang: 'xx' } })).status, 400);
  const id = (await me(a)).id;
  const row = (await call(`/api/admin/accounts/${id}`, { cookie: admin })).data.account;
  assert.equal((await call(`/api/admin/accounts/${id}/identity`, { method: 'PATCH', cookie: admin, body: { name: row.name, sheetName: row.sheetName, lang: 'xx' } })).status, 400);
});

test('înregistrarea: fără limbă e română; o limbă în probă nu se poate cere', async () => {
  const body = (email, lang) => ({ email, password: 'parola-de-test-123', name: 'Nou', ...(lang ? { lang } : {}) });
  const no = await call('/api/auth/register', { method: 'POST', auth: 'none', body: body('limba1@exemplu.test', 'hu') });
  assert.equal(no.status, 400);
  const ok = await call('/api/auth/register', { method: 'POST', auth: 'none', body: body('limba2@exemplu.test') });
  assert.equal(ok.status, 201);
  assert.equal(ok.data.account.lang, 'ro');
});

test('vânzătorul face un cont nou direct în maghiară', async () => {
  const r = await call('/api/admin/accounts', { method: 'POST', cookie: admin, body: { name: 'Kovács Béla', email: 'bela@exemplu.test', lang: 'hu' } });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  assert.equal(r.data.account.lang, 'hu');
});

test('fără cont, telefonul în maghiară primește încă româna (maghiara e în probă)', async () => {
  const r = await call('/api/auth/login', {
    method: 'POST', auth: 'none', headers: { 'Accept-Language': 'hu-HU,hu;q=0.9' }, body: { email: 'nimeni@exemplu.test', password: 'gresit-gresit-1' },
  });
  assert.equal(r.status, 401);
  assert.match(r.data.error, /^Email sau parolă greșită/);
});

test('mesajele serverului vin în limba contului (maghiară), iar în română rămân cele de azi', async () => {
  const a = await newAccount(call, 'Gábor');
  await setLang(call, (await me(a)).id, 'hu');
  const bad = await call('/api/pigeons', { method: 'POST', cookie: a, body: { kind: 'own', ring: '000' } });
  assert.equal(bad.status, 400);
  assert.equal(bad.data.error, 'A gyűrűszám nem olvasható. Írd úgy, mint a példában: RO-25-123456.');
  const locked = await call('/api/auth/me', { method: 'PATCH', cookie: a, body: { name: 'Altul' } });
  assert.equal(locked.status, 403);
  assert.match(locked.data.error, /eladó/);
  const field = await call('/api/pigeons', { method: 'POST', cookie: a, body: { kind: 'own', ring: 'RO-26-800549', name: 'x'.repeat(200) } });
  assert.equal(field.status, 400);
  assert.doesNotMatch(field.data.error, /[ăâîșț]|camp\./, 'numele câmpului e și el tradus');
  const ro = await newAccount(call, 'Ion');
  const badRo = await call('/api/pigeons', { method: 'POST', cookie: ro, body: { kind: 'own', ring: '000' } });
  assert.equal(badRo.data.error, 'Inelul nu poate fi citit. Scrie-l ca în exemplu: RO-25-123456.');
});

test('catalogul de la server vine în limba contului', async () => {
  const a = await newAccount(call, 'Ilona');
  await setLang(call, (await me(a)).id, 'hu');
  const hu = (await call('/api/catalog', { cookie: a })).data;
  assert.equal(hu.colors.find((c) => c.code === 'solzat').label, 'Kék kovácsolt');
  const none = (await call('/api/catalog', { auth: 'none' })).data;
  assert.equal(none.colors.find((c) => c.code === 'solzat').label, 'Solzat');
});

test('mesajele fără diacritice (serii, linii, an, culori, concurs) vin și ele în maghiară', async () => {
  const a = await newAccount(call, 'Lajos');
  await setLang(call, (await me(a)).id, 'hu');
  const colors = await call('/api/colors/predict', { method: 'POST', cookie: a, body: {} });
  assert.equal(colors.status, 400);
  assert.doesNotMatch(colors.data.error, /Lipsesc/);
  const lines = await call('/api/pigeons', { method: 'POST', cookie: a, body: { kind: 'own', ring: 'RO-26-800560', lines: Array.from({ length: 11 }, (_, i) => `L${i}`) } });
  assert.equal(lines.status, 400);
  assert.doesNotMatch(lines.data.error, /Cel mult/);
});

test('preluat de pe linkul unui crescător român: culoarea din listă rămâne cod, deci apare tradusă', async () => {
  const ro = await newAccount(call, 'Petru');
  const p = (await call('/api/pigeons', { method: 'POST', cookie: ro, body: { kind: 'own', ring: 'RO-26-800561', color: 'solzat', colorPa: true } })).data.pigeon;
  const link = (await call(`/api/pigeons/${p.id}/public`, { method: 'POST', cookie: ro })).data.url;
  const hu = await newAccount(call, 'Zoltán');
  await setLang(call, (await me(hu)).id, 'hu');
  const r = await call(`/api/public/${link.split('/p/')[1]}/import`, { method: 'POST', cookie: hu });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  const mine = (await call(`/api/pigeons/${r.data.pigeonId}`, { cookie: hu })).data.pigeon;
  assert.equal(mine.color, 'solzat');
  assert.equal(mine.colorPa, true);
  assert.equal(mine.colorText ?? null, null, 'fără textul românesc al culorii');
});

test('inel maghiar fără numărul asociației: mesaj clar, în limba omului', async () => {
  const a = await newAccount(call, 'Ferenc');
  const ro = await call('/api/pigeons', { method: 'POST', cookie: a, body: { kind: 'own', ring: '14530/23 HU' } });
  assert.equal(ro.status, 400);
  assert.match(ro.data.error, /HU-2023-29-14530/);
  const ok = await call('/api/pigeons', { method: 'POST', cookie: a, body: { kind: 'own', ring: 'HU-2023-29-14530 H' } });
  assert.equal(ok.status, 201, JSON.stringify(ok.data));
  assert.equal(ok.data.pigeon.ring.display, 'HU-2023-29-14530');
  assert.equal(ok.data.pigeon.sex, 'M');
});

test('o limbă publică (maghiara, ca acum) se poate alege la înregistrare și schimba singur în Cont', async () => {
  hu.public = true;
  try {
    const r = await call('/api/auth/register', { method: 'POST', auth: 'none', body: { email: 'publica@exemplu.test', password: 'parola-de-test-123', name: 'Nagy Péter', lang: 'hu' } });
    assert.equal(r.status, 201, JSON.stringify(r.data));
    assert.equal(r.data.account.lang, 'hu');
    const a = await newAccount(call, 'Vasile Public');
    assert.equal((await call('/api/auth/me', { method: 'PATCH', cookie: a, body: { lang: 'hu' } })).status, 200);
    assert.equal((await me(a)).lang, 'hu');
  } finally {
    hu.public = false;
  }
});

// Japoneza e chiar „în probă” (public: false în languages.json), nu doar în test.
test('japoneza în probă: fără cont, telefonul în japoneză primește româna', async () => {
  const r = await call('/api/auth/login', {
    method: 'POST', auth: 'none', headers: { 'Accept-Language': 'ja-JP,ja;q=0.9' }, body: { email: 'nimeni@exemplu.test', password: 'gresit-gresit-1' },
  });
  assert.equal(r.status, 401);
  assert.match(r.data.error, /^Email sau parolă greșită/);
  const reg = await call('/api/auth/register', { method: 'POST', auth: 'none', body: { email: 'limba-ja@exemplu.test', password: 'parola-de-test-123', name: 'Nou', lang: 'ja' } });
  assert.equal(reg.status, 400);
});

test('japoneza în probă: o pune doar vânzătorul, iar mesajele, catalogul și dicționarul vin în japoneză', async () => {
  const a = await newAccount(call, 'Tanaka');
  const id = (await me(a)).id;
  assert.equal((await call('/api/auth/me', { method: 'PATCH', cookie: a, body: { lang: 'ja' } })).status, 403, 'omul nu și-o poate pune singur');
  assert.equal((await me(a)).lang, 'ro');
  await setLang(call, id, 'ja');
  assert.equal((await me(a)).lang, 'ja');
  assert.equal((await call('/api/auth/me', { method: 'PATCH', cookie: a, body: { lang: 'ja' } })).status, 200, 'rămâne în limba lui');
  const bad = await call('/api/pigeons', { method: 'POST', cookie: a, body: { kind: 'own', ring: '000' } });
  assert.equal(bad.status, 400);
  assert.equal(bad.data.error, t('ja', 'eroare.inel_necitit'));
  assert.match(bad.data.error, /[぀-ヿ]/);
  const colors = (await call('/api/catalog', { cookie: a })).data.colors;
  assert.equal(colors.find((c) => c.code === 'solzat').label, t('ja', 'catalog.culoare.solzat'));
  const dict = await call('/i18n/ja.json', { auth: 'none' });
  assert.equal(dict.status, 200);
  assert.equal(dict.data['cont.limba'], t('ja', 'cont.limba'));
  assert.equal((await call('/api/auth/me', { method: 'PATCH', cookie: a, body: { lang: 'ro' } })).status, 200);
  assert.equal((await call('/api/auth/me', { method: 'PATCH', cookie: a, body: { lang: 'ja' } })).status, 403, 'nu se mai poate întoarce singur');
});

test('vânzătorul face un cont nou direct în japoneză', async () => {
  const r = await call('/api/admin/accounts', { method: 'POST', cookie: admin, body: { name: 'Tanaka Ichirō', email: 'tanaka@exemplu.test', lang: 'ja' } });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  assert.equal(r.data.account.lang, 'ja');
});

test('data din textele tratamentelor: ca pe ecran, în forma fiecărei limbi', async () => {
  const { formatDate } = await import('../src/treatments.js');
  assert.equal(formatDate('2026-01-05', 'ro'), '05.01.2026');
  assert.equal(formatDate('2026-01-05', 'hu'), '2026. 01. 05.');
  assert.equal(formatDate('2026-01-05', 'ja'), '2026/1/5');
  assert.equal(formatDate('2026-11-25', 'ja'), '2026/11/25');
});
