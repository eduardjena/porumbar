import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { apiCaller } from './helpers/api.js';
import { startTestApp } from './helpers/db.js';
import { newAccount, setLang, today } from './helpers/accounts.js';
import { BUCHAREST, atLocal } from '../src/zones.js';

// Amintirile cuibului, în aceeași notificare de seară și același email cu tratamentele (expeditor fals, sentMails),
// cu `now` fixat. Fiecare test își ia zilele lui (la 30 de zile una de alta), ca rulările unui test să nu atingă
// pontele altuia.

let server;
let base;
let remind;
let eveningLines;
let all;
let dbRun;
let setPushSender;
let sentMails;
let atBucharest;
const call = apiCaller(() => ({ base }));

const pushes = [];
const answers = new Map();

before(async () => {
  delete process.env.SMTP_URL;
  delete process.env.SMTP_HOST;
  ({ server, base } = await startTestApp());
  ({ runTreatmentReminders: remind } = await import('../src/treatment-reminders.js'));
  ({ nestEveningLines: eveningLines } = await import('../src/nest-reminders.js'));
  ({ all, run: dbRun } = await import('../src/db.js'));
  ({ setPushSender } = await import('../src/push.js'));
  ({ sentMails } = await import('../src/mail.js'));
  ({ atBucharest } = await import('../src/treatment-schedule.js'));
  setPushSender(async (sub, payload) => {
    pushes.push({ endpoint: sub.endpoint, payload });
    return answers.get(sub.endpoint) ?? 'ok';
  });
});
after(() => {
  setPushSender?.(null);
  server?.close();
});
beforeEach(() => answers.clear());

const run = (now) => remind(now, { emailDelayMs: 0 });
const addDays = (iso, n) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86400_000).toISOString().slice(0, 10);
const TOKYO = 'Asia/Tokyo';
/** Ora `hour`:`min` din ziua `date`, în zona `zone` (implicit ora României). */
const at = (date, hour, min = 5, zone = BUCHAREST) => new Date(atLocal(date, hour, zone).getTime() + min * 60_000);
let slot = 0;
const nextDay = () => addDays(today(), 10 + 30 * slot++);

let seq = 0;
async function account(name, { lang } = {}) {
  const cookie = await newAccount(call, name);
  const me = (await call('/api/auth/me', { cookie })).data.account;
  if (lang) await setLang(call, me.id, lang);
  return { cookie, id: me.id, email: me.email };
}

async function device(acc) {
  const endpoint = `https://fcm.googleapis.com/fcm/send/cuib-${acc.id}`;
  const r = await call('/api/auth/push', { method: 'POST', cookie: acc.cookie, body: { endpoint, keys: { p256dh: 'p', auth: 'a' } } });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  return endpoint;
}

/** O pereche nouă (cu cuibul `nest`) și ponta ei, salvată „demult” (înaintea oricărui moment din test). */
async function clutch(acc, nest, body) {
  seq += 1;
  const mk = async (sex, ring) => (await call('/api/pigeons', { method: 'POST', cookie: acc.cookie, body: { kind: 'own', ring, sex } })).data.pigeon;
  const cock = await mk('M', `RO-24-${300000 + seq * 2}`);
  const hen = await mk('F', `RO-24-${300001 + seq * 2}`);
  const p = await call('/api/pairs', { method: 'POST', cookie: acc.cookie, body: { cockId: cock.id, henId: hen.id, season: 2026, nest } });
  assert.equal(p.status, 201, JSON.stringify(p.data));
  const r = await call(`/api/pairs/${p.data.pair.id}/clutches`, { method: 'POST', cookie: acc.cookie, body });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  await dbRun(`UPDATE clutches SET created_at = '2020-01-01T00:00:00Z', updated_at = '2020-01-01T00:00:00Z' WHERE id = ?`, r.data.clutch.id);
  return r.data.clutch;
}

/** Un tratament salvat „demult”. */
async function treatment(acc, startDate) {
  const body = { name: 'tricomonaza', kind: 'tratament', method: 'apa', days: 3, target: 'toti', repeat: null, startDate };
  const r = await call('/api/treatments', { method: 'POST', cookie: acc.cookie, body });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  await dbRun(`UPDATE treatments SET created_at = '2020-01-01T00:00:00Z', updated_at = '2020-01-01T00:00:00Z' WHERE id = ?`, r.data.treatment.id);
  return r.data.treatment;
}

const readOnly = (acc) => dbRun('UPDATE accounts SET subscription_start = NULL, subscription_end = NULL WHERE id = ?', acc.id);
const pushesTo = (endpoint) => pushes.filter((p) => p.endpoint === endpoint);
const mailsTo = (acc) => sentMails.filter((m) => m.to === acc.email);
const notices = (c) => all('SELECT kind, on_date FROM nest_notices WHERE clutch_id = ? ORDER BY on_date, kind', c.id);
const TREATMENT_LINE = /^Mâine începe: Tricomonază \(gălbenele\), \d+ (de )?porumbei \(în apă\)$/;

test('seara: în ajunul eclozării, o notificare cu cuibul; a doua rulare din fereastră nu mai trimite', async () => {
  const d = nextDay();
  const a = await account('Seara');
  const ep = await device(a);
  const c = await clutch(a, '7', { egg1On: d, egg2On: d });
  await run(at(addDays(d, 16), 19));
  const got = pushesTo(ep);
  assert.equal(got.length, 1);
  assert.equal(got[0].payload.title, 'Pigeonrama');
  assert.equal(got[0].payload.body, 'Mâine pot ieși puii: cuibul 7');
  assert.equal(got[0].payload.url, '/panou');
  assert.deepEqual(await notices(c), [{ kind: 'eclozare', on_date: addDays(d, 16) }]);
  await run(at(addDays(d, 16), 19, 30));
  await run(at(addDays(d, 16), 20));
  assert.equal(pushesTo(ep).length, 1);
  assert.equal(mailsTo(a).length, 0, 'are un dispozitiv care a primit: fără email');
});

test('trei ponte de același fel în aceeași seară: un singur rând care numește toate cuiburile', async () => {
  const d = nextDay();
  const a = await account('Grupat');
  const ep = await device(a);
  for (const nest of ['7', '3', '5']) await clutch(a, nest, { egg1On: d, egg2On: d });
  await run(at(addDays(d, 16), 19));
  const got = pushesTo(ep);
  assert.equal(got.length, 1);
  assert.equal(got[0].payload.body, 'Mâine pot ieși puii: cuibul 3, 5, 7');
});

test('un singur mesaj: tratamentul și cuibul în aceeași notificare; fără dispozitiv, în același email', async () => {
  const d = nextDay();
  const a = await account('UnMesaj');
  const ep = await device(a);
  const b = await account('UnEmail');
  for (const acc of [a, b]) {
    // Puii ieșiți cu 6 zile înainte de `d`: inelarea începe în ziua `d`.
    await clutch(acc, '3', { egg1On: addDays(d, -24), egg2On: addDays(d, -24), hatchedOn: addDays(d, -6), hatched: 2 });
    await treatment(acc, d);
  }
  await run(at(addDays(d, -1), 19));
  const got = pushesTo(ep);
  assert.equal(got.length, 1);
  const lines = got[0].payload.body.split('\n');
  assert.equal(lines.length, 2, got[0].payload.body);
  assert.match(lines[0], TREATMENT_LINE);
  assert.equal(lines[1], 'Mâine începe inelarea puilor: cuibul 3');
  assert.equal(got[0].payload.url, '/panou');
  assert.equal(mailsTo(a).length, 0);
  const mails = mailsTo(b);
  assert.equal(mails.length, 1);
  assert.equal(mails[0].subject, 'Pigeonrama: amintire pentru tratamente și cuiburi');
  assert.match(mails[0].text, /- Mâine începe: Tricomonază \(gălbenele\), \d+ (de )?porumbei \(în apă\)\n- Mâine începe inelarea puilor: cuibul 3\n/);
  assert.ok(mails[0].text.includes('http://localhost:3100/panou'), mails[0].text);
  const last = mails[0].text.trim().split('\n').at(-1);
  assert.ok(last.includes('Cont → Amintiri'), last);
  assert.equal((await all('SELECT 1 FROM email_digests WHERE account_id = ?', b.id)).length, 1);
  // A doua rulare din fereastră: nimic nou.
  await run(at(addDays(d, -1), 20));
  assert.equal(pushesTo(ep).length, 1);
  assert.equal(mailsTo(b).length, 1);
});

test('dimineața: ultima zi de inelare la 07:00; seara dinainte, „mâine e ultima zi de inelare” doar în email', async () => {
  const h = nextDay();
  const a = await account('Dimineata');
  const ep = await device(a);
  const b = await account('DimineataEmail');
  const ca = await clutch(a, '5', { egg1On: addDays(h, -18), egg2On: addDays(h, -18), hatchedOn: h, hatched: 2 });
  await clutch(b, '5', { egg1On: addDays(h, -18), egg2On: addDays(h, -18), hatchedOn: h, hatched: 2 });
  // Ajunul ultimei zile (ziua 8 după eclozare): lista serii are rândul, notificarea serii nu (vine dimineața).
  const evening = atBucharest(addDays(h, 7), 19);
  const list = (await eveningLines(addDays(h, 7), evening)).get(a.id);
  assert.deepEqual(list, [{ kind: 'inelare_ultima_maine', text: 'Mâine e ultima zi de inelare: cuibul 5' }]);
  await run(at(addDays(h, 7), 19));
  assert.equal(pushesTo(ep).length, 0);
  assert.equal(mailsTo(a).length, 0, 'are dispozitiv: fără email');
  assert.equal(mailsTo(b).length, 1);
  assert.equal(mailsTo(b)[0].subject, 'Pigeonrama: amintire pentru cuiburi');
  assert.match(mailsTo(b)[0].text, /- Mâine e ultima zi de inelare: cuibul 5\n/);
  // Dimineața ultimei zile: notificarea; emailul nu (doar seara).
  await run(at(addDays(h, 8), 7, 10));
  const got = pushesTo(ep);
  assert.equal(got.length, 1);
  assert.equal(got[0].payload.body, 'Azi e ultima zi de inelare: cuibul 5');
  assert.equal(got[0].payload.url, '/panou');
  assert.equal(mailsTo(b).length, 1);
  assert.deepEqual((await notices(ca)).map((n) => n.kind), ['inelare_ultima']);
});

test('trecut înainte de oră: al doilea ou pus la 18:00 în ajun → fără amintire la 19:05', async () => {
  const d = nextDay();
  const a = await account('Trecut');
  const ep = await device(a);
  const done = await clutch(a, '1', { egg1On: d });
  const waiting = await clutch(a, '2', { egg1On: d });
  const r = await call(`/api/clutches/${done.id}`, { method: 'PATCH', cookie: a.cookie, body: { egg2On: addDays(d, 1) } });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  await dbRun('UPDATE clutches SET updated_at = ? WHERE id = ?', at(addDays(d, 1), 18, 0).toISOString(), done.id);
  await run(at(addDays(d, 1), 19));
  const got = pushesTo(ep);
  assert.equal(got.length, 1);
  assert.equal(got[0].payload.body, 'Mâine e așteptat al doilea ou: cuibul 2');
  assert.deepEqual(await notices(done), []);
  assert.deepEqual((await notices(waiting)).map((n) => n.kind), ['ou2']);
});

test('mirarea mutată de al doilea ou pus târziu nu se amintește a doua oară (nici pe email)', async () => {
  const d = nextDay();
  const a = await account('Mirare');
  const ep = await device(a);
  const b = await account('MirareEmail');
  const ca = await clutch(a, '4', { egg1On: d });
  const cb = await clutch(b, '4', { egg1On: d });
  // Fără al doilea ou: mirarea se socotește de la +2 → începe la +7, amintirea în seara de +6.
  await run(at(addDays(d, 6), 19));
  assert.equal(pushesTo(ep).length, 1);
  assert.equal(pushesTo(ep)[0].payload.body, 'Mâine e mirarea ouălor: cuibul 4');
  assert.equal(mailsTo(b).length, 1);
  // Al doilea ou trecut târziu (+3): mirarea se mută cu o zi; nicio amintire nouă.
  for (const [acc, c] of [[a, ca], [b, cb]]) {
    const r = await call(`/api/clutches/${c.id}`, { method: 'PATCH', cookie: acc.cookie, body: { egg2On: addDays(d, 3) } });
    assert.equal(r.status, 200, JSON.stringify(r.data));
    await dbRun('UPDATE clutches SET updated_at = ? WHERE id = ?', at(addDays(d, 6), 20, 0).toISOString(), c.id);
  }
  assert.equal((await eveningLines(addDays(d, 7), atBucharest(addDays(d, 7), 19))).get(b.id), undefined);
  await run(at(addDays(d, 7), 19));
  assert.equal(pushesTo(ep).length, 1);
  assert.equal(mailsTo(b).length, 1);
  assert.deepEqual((await notices(ca)).map((n) => n.kind), ['mirare']);
});

test('doar citire: fără amintiri de cuib; amintirile tratamentelor merg ca până acum', async () => {
  const d = nextDay();
  const a = await account('CitireDisp');
  const ep = await device(a);
  const b = await account('CitireEmail');
  const c = await account('CitireDoarCuib');
  const clutches = [];
  for (const acc of [a, b, c]) clutches.push(await clutch(acc, '9', { egg1On: addDays(d, -17), egg2On: addDays(d, -17) }));
  const trA = await treatment(a, d);
  await treatment(b, d);
  for (const acc of [a, b, c]) await readOnly(acc);
  await run(at(addDays(d, -1), 19));
  const got = pushesTo(ep);
  assert.equal(got.length, 1);
  assert.match(got[0].payload.body, TREATMENT_LINE);
  assert.equal(got[0].payload.url, `/tratamente/${trA.id}`);
  assert.equal(mailsTo(b).length, 1);
  assert.equal(mailsTo(b)[0].subject, 'Pigeonrama: amintire pentru tratamente');
  assert.ok(!mailsTo(b)[0].text.includes('cuibul'), mailsTo(b)[0].text);
  assert.equal(mailsTo(c).length, 0);
  assert.equal((await all('SELECT 1 FROM email_digests WHERE account_id = ?', c.id)).length, 0);
  for (const cl of clutches) assert.deepEqual(await notices(cl), []);
});

test('inelare întârziată: din ziua 9 după eclozare, nicio amintire', async () => {
  const h = nextDay();
  const a = await account('Intarziat');
  const ep = await device(a);
  const b = await account('IntarziatEmail');
  for (const acc of [a, b]) await clutch(acc, '8', { egg1On: addDays(h, -18), egg2On: addDays(h, -18), hatchedOn: h, hatched: 2 });
  for (const k of [9, 10]) {
    await run(at(addDays(h, k), 7, 10));
    await run(at(addDays(h, k), 19));
  }
  assert.equal(pushesTo(ep).length, 0);
  assert.equal(mailsTo(b).length, 0);
});

test('închisă („Nu mai urmări”): nimic', async () => {
  const d = nextDay();
  const a = await account('Inchisa');
  const ep = await device(a);
  const b = await account('InchisaEmail');
  for (const acc of [a, b]) {
    const cl = await clutch(acc, '6', { egg1On: addDays(d, -17), egg2On: addDays(d, -17) });
    await dbRun('UPDATE clutches SET calendar_closed_on = ? WHERE id = ?', addDays(d, -10), cl.id);
  }
  await run(at(addDays(d, -1), 19));
  assert.equal(pushesTo(ep).length, 0);
  assert.equal(mailsTo(b).length, 0);
});

test('ora țării contului: la un cont ja, amintirile cuibului vin la 19:00 și 07:00 la Tokyo', async () => {
  const h = nextDay();
  const ja = await account('CuibTokio', { lang: 'ja' });
  const ep = await device(ja);
  const jaMail = await account('CuibTokioEmail', { lang: 'ja' });
  const ro = await account('CuibBucuresti');
  const epRo = await device(ro);
  const clutches = [];
  for (const acc of [ja, jaMail, ro]) clutches.push(await clutch(acc, '2', { egg1On: addDays(h, -18), egg2On: addDays(h, -18), hatchedOn: h, hatched: 2 }));
  // Ajunul inelării (ziua 6 după eclozare), 19:05 la Tokyo: notificarea la ja, emailul la ja fără dispozitiv; ro nimic.
  await run(at(addDays(h, 5), 19, 5, TOKYO));
  assert.equal(pushesTo(ep).length, 1);
  assert.equal(pushesTo(epRo).length, 0);
  assert.equal(mailsTo(jaMail).length, 1);
  assert.deepEqual(await notices(clutches[0]), [{ kind: 'inelare', on_date: addDays(h, 5) }]);
  assert.deepEqual(await notices(clutches[2]), []);
  // Același moment la București: doar ro.
  await run(at(addDays(h, 5), 19));
  assert.equal(pushesTo(ep).length, 1);
  assert.equal(pushesTo(epRo).length, 1);
  assert.equal(mailsTo(jaMail).length, 1);
  // Ultima zi de inelare, 07:10 la Tokyo: notificarea la ja; la București e noapte.
  await run(at(addDays(h, 8), 7, 10, TOKYO));
  assert.equal(pushesTo(ep).length, 2);
  assert.equal(pushesTo(epRo).length, 1);
  assert.deepEqual((await notices(clutches[0])).map((n) => n.kind), ['inelare', 'inelare_ultima']);
});
