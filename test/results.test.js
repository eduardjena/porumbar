import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { apiCaller } from './helpers/api.js';
import { startTestApp } from './helpers/db.js';
import { newAccount } from './helpers/accounts.js';

let server;
let base;
let a;
let b;
let p1;
let p2;
const call = apiCaller(() => ({ base }));
before(async () => {
  ({ server, base } = await startTestApp());
  a = await newAccount(call, 'A');
  b = await newAccount(call, 'B');
  p1 = (await call('/api/pigeons', { method: 'POST', cookie: a, body: { kind: 'own', ring: 'RO-25-276971', sex: 'F' } })).data.pigeon;
  p2 = (await call('/api/pigeons', { method: 'POST', cookie: a, body: { kind: 'own', ring: 'RO-25-276960', sex: 'F' } })).data.pigeon;
});
after(() => server?.close());

// Primul rând din clasamentul columba.ro din docs/exemple (Yablanița, 04.05.2026).
const yablanita = { number: 1, organizer: 'Vâlcea', category: 'viteza', date: '2026-05-04', releasePlace: 'Yablanița', releaseTime: '08:01', entered: 10023 };
const add = (pigeon, body, cookie = a) => call(`/api/pigeons/${pigeon.id}/results`, { method: 'POST', cookie, body });

test('rezultatul ca în clasamentul columba.ro: viteza, coeficientul și rândul scurt se calculează', async () => {
  const r = await add(p1, { race: yablanita, place: 1, distanceKm: 196.608, arrival: { day: 1, time: '10:15:43' }, fci: 0.2 });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  const res = r.data.result;
  assert.equal(res.place, 1);
  assert.equal(res.distanceM, 196608);
  assert.equal(res.race.entered, 10023);
  assert.equal(res.speed, 1459.42, 'columba: VIT.MED. 1459.42 m/min');
  assert.equal(res.flightMinutes, 134.7167, 'columba: T.REAL 134.7167');
  assert.equal(res.penalty, 0.0998, 'columba: PENALIZ. 0.10 (calculat cu 4 zecimale, afișat cu 2)');
  assert.equal(res.fci, 0.2);
  assert.equal(res.short, "1e-197KM-10023P-'26");
  assert.equal(res.onPedigree, true);
});

test('al doilea porumbel în același concurs refolosește concursul; același porumbel nu intră de două ori', async () => {
  const r = await add(p2, { race: { ...yablanita, organizer: 'valcea ', releasePlace: 'YABLANITA', entered: null }, place: 9, distanceKm: '196,608' });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  const races = (await call('/api/races', { cookie: a })).data.races;
  assert.equal(races.length, 1, 'același concurs (fără diacritice / litere mari) nu se dublează');
  assert.equal(races[0].entered, 10023, 'angajații rămân cei știuți');
  assert.equal(r.data.result.penalty, 0.8979);
  assert.equal(r.data.result.fci, 1.8, 'columba: FCI 1.80 (9 × 1000 / 5.000), calculat de program');
  assert.equal(r.data.result.speed, null, 'fără ora sosirii nu se inventează viteza');
  const again = await add(p1, { race: yablanita, place: 5, distanceKm: 196.608 });
  assert.equal(again.status, 409);
});

test('lista pe porumbel, schimbarea și ștergerea', async () => {
  const list = (await call(`/api/pigeons/${p1.id}/results`, { cookie: a })).data.results;
  assert.equal(list.length, 1);
  const id = list[0].id;
  const upd = await call(`/api/results/${id}`, { method: 'PATCH', cookie: a, body: { race: yablanita, place: 2, distanceKm: 196.608, speed: 1451.5, onPedigree: false } });
  assert.equal(upd.status, 200, JSON.stringify(upd.data));
  assert.equal(upd.data.result.place, 2);
  assert.equal(upd.data.result.speed, 1451.5, 'viteza scrisă de om are prioritate');
  assert.equal(upd.data.result.onPedigree, false);
  assert.equal((await call(`/api/results/${id}`, { method: 'DELETE', cookie: b })).status, 404);
  assert.equal((await call(`/api/results/${id}`, { method: 'PATCH', cookie: b, body: { race: yablanita, place: 1, distanceKm: 1 } })).status, 404);
  assert.equal((await call(`/api/results/${id}`, { method: 'DELETE', cookie: a })).status, 204);
  assert.equal((await call(`/api/pigeons/${p1.id}/results`, { cookie: a })).data.results.length, 0);
  assert.equal((await call('/api/races', { cookie: a })).data.races.length, 1, 'concursul rămâne cât timp are rezultatul lui p2');
});

test('un concurs rămas fără rezultate dispare din listă', async () => {
  const r = (await add(p1, { race: { ...yablanita, releasePlace: 'Sofia', date: '2026-06-01' }, place: 4, distanceKm: 300 })).data.result;
  assert.equal((await call('/api/races', { cookie: a })).data.races.length, 2);
  await call(`/api/results/${r.id}`, { method: 'PATCH', cookie: a, body: { race: { ...yablanita, releasePlace: 'Ruse', date: '2026-06-08' }, place: 4, distanceKm: 250 } });
  assert.deepEqual((await call('/api/races', { cookie: a })).data.races.map((x) => x.releasePlace).sort(), ['Ruse', 'Yablanița'], 'Sofia a rămas goală după mutare');
  await call(`/api/results/${r.id}`, { method: 'DELETE', cookie: a });
  assert.deepEqual((await call('/api/races', { cookie: a })).data.races.map((x) => x.releasePlace), ['Yablanița']);
});

test('date greșite sunt refuzate cu mesaj', async () => {
  const bad = [
    { race: { ...yablanita, date: '2026-02-30' }, place: 1, distanceKm: 100 },
    { race: { ...yablanita, category: 'inventata' }, place: 1, distanceKm: 100 },
    { race: { ...yablanita, releasePlace: '' }, place: 1, distanceKm: 100 },
    { race: yablanita, place: 0, distanceKm: 100 },
    { race: yablanita, place: 1.5, distanceKm: 100 },
    { race: yablanita, place: 20000, distanceKm: 100 },
    { race: yablanita, place: 1, distanceKm: 0 },
    { race: yablanita, place: 1, distanceKm: 5000 },
    { race: yablanita, place: 1, distanceKm: 'departe' },
    { race: yablanita, place: 1, distanceKm: 100, arrival: { day: 1, time: '25:00' } },
    { race: yablanita, place: 1, distanceKm: 100, speed: 'repede' },
    { race: { ...yablanita, entered: -3 }, place: 1, distanceKm: 100 },
  ];
  for (const body of bad) {
    const r = await add(p1, body);
    assert.equal(r.status, 400, JSON.stringify(body));
    assert.ok(r.data.error, 'are mesaj');
  }
});

test('alt cont nu vede și nu scrie rezultatele; concursurile sunt ale fiecărui cont', async () => {
  assert.equal((await call(`/api/pigeons/${p2.id}/results`, { cookie: b })).status, 404);
  assert.equal((await add(p2, { race: yablanita, place: 1, distanceKm: 100 }, b)).status, 404);
  assert.equal((await call('/api/races', { cookie: b })).data.races.length, 0);
});

test('pe pedigree apar rândurile scurte ale rezultatelor bifate', async () => {
  const ped = (await call(`/api/pigeons/${p2.id}/pedigree`, { cookie: a })).data;
  assert.deepEqual(ped.root.results, ["9e-197KM-10023P-'26"]);
});

test('la preluare / cumpărare, rezultatele intră în textul de pedigree', async () => {
  const { toImportNode } = await import('../src/pedigree-format.js');
  const n = toImportNode({ ring: 'RO-25-1', results: ["1e-197KM-10023P-'26"], pedigreeText: 'Super reproducătoare', father: null, mother: null });
  assert.equal(n.text, "1e-197KM-10023P-'26; Super reproducătoare");
  assert.equal(toImportNode({ ring: 'RO-25-1', results: [], pedigreeText: null }).text, null);
});

// Cele șase corecturi din cercetare (docs/cercetare/reports/Concursuri columbofile în Porumbar.md): Porumbar dă
// aceleași cifre ca foaia Columba.
let p3;
const own = async (ring) => (await call('/api/pigeons', { method: 'POST', cookie: a, body: { kind: 'own', ring } })).data.pigeon;

test('categoriile se numesc ca la Columba: Demifond (semifond), Extrem (mare fond)', async () => {
  const cats = (await call('/api/catalog', { cookie: a })).data.raceCategories;
  const label = (code) => cats.find((c) => c.code === code)?.label;
  assert.equal(label('semifond'), 'Demifond (semifond)');
  assert.equal(label('mare-fond'), 'Extrem (mare fond)');
});

test('coeficientul FCI îl calculează programul: împărțit la cel mult 5.000, fără plafon la Maraton și Extrem', async () => {
  p3 = await own('RO-25-1286132');
  const r = (await add(p3, { race: { ...yablanita, releasePlace: 'Barcelona', date: '2026-07-01', category: 'maraton' }, place: 10, distanceKm: 1500 })).data.result;
  assert.equal(r.fci, 0.9977, 'la Maraton: 10 × 1000 / 10.023');
  const x = (await add(p3, { race: { ...yablanita, releasePlace: 'Pau', date: '2026-07-20', category: 'mare-fond' }, place: 10, distanceKm: 1600 })).data.result;
  assert.equal(x.fci, 0.9977, 'la Extrem: tot fără plafon');
  const y = (await add(p3, { race: { ...yablanita, releasePlace: 'Mic', date: '2026-04-01', entered: 300 }, place: 3, distanceKm: 120 })).data.result;
  assert.equal(y.fci, 10, 'sub 5.000 de porumbei: 3 × 1000 / 300');
  assert.equal(y.fciEntered, null);
  const z = (await add(p3, { race: { ...yablanita, releasePlace: 'Scris', date: '2026-04-08' }, place: 3, distanceKm: 120, fci: 0.61 })).data.result;
  assert.equal(z.fci, 0.61, 'cel scris de om (din clasament) rămâne');
  assert.equal(z.fciEntered, 0.61);
});

test('ziua sosirii până la 7; din ziua a 2-a viteza se ia din clasament (noaptea se scade)', async () => {
  const r = (await add(p3, { race: { ...yablanita, releasePlace: 'Lunga', date: '2026-08-01', category: 'fond' }, place: 4, distanceKm: 900, arrival: { day: 7, time: '06:10' } })).data.result;
  assert.equal(r.arrival.day, 7);
  assert.equal(r.speed, null, 'nu se calculează peste noapte');
  assert.equal(r.speedFromSheet, true, 'interfața cere viteza din clasament');
  const bad = await add(p3, { race: { ...yablanita, releasePlace: 'Prea', date: '2026-08-02' }, place: 4, distanceKm: 900, arrival: { day: 8, time: '06:10' } });
  assert.equal(bad.status, 400);
  const first = (await call(`/api/pigeons/${p3.id}/results`, { cookie: a })).data.results.find((x) => x.race.releasePlace === 'Mic');
  assert.equal(first.speedFromSheet, false);
});

test('clasamentul (club, filială, zonă, național): alt clasament e alt rând, iar pe pedigree apare nivelul', async () => {
  const p = await own('RO-25-2012738');
  const jud = (await add(p, { race: { ...yablanita, level: 'filiala' }, place: 1, distanceKm: 196.608 })).data.result;
  assert.equal(jud.race.level, 'filiala');
  assert.equal(jud.short, "1e Jud.-197KM-10023P-'26");
  const nat = await add(p, { race: { ...yablanita, level: 'national', entered: 30000 }, place: 15, distanceKm: 196.608 });
  assert.equal(nat.status, 201, 'același porumbel, alt clasament al aceluiași concurs');
  assert.equal(nat.data.result.short, "15e Nat.-197KM-30000P-'26");
  assert.equal((await add(p, { race: { ...yablanita, level: 'planetar' }, place: 1, distanceKm: 1 })).status, 400);
  const plain = (await call(`/api/pigeons/${p2.id}/results`, { cookie: a })).data.results[0];
  assert.equal(plain.race.level, null, 'rezultatele vechi rămân fără nivel');
  assert.equal(plain.short, "9e-197KM-10023P-'26");
});

test('„premiat” = în primii 20% din porumbeii angajați (1 din 5)', async () => {
  const p = await own('RO-25-2014629');
  const at = async (place, extra = {}) => (await add(p, { race: { ...yablanita, releasePlace: `Premiu ${place}`, ...extra }, place, distanceKm: 100 })).data.result.prized;
  assert.equal(await at(2005), true, '20% din 10.023 = 2.004,6, rotunjit în sus: 2.005 (cât a clasat Columba)');
  assert.equal(await at(2006), false);
  assert.equal(await at(3, { entered: null }), null, 'fără porumbeii angajați nu se știe');
});
