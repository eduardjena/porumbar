import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { apiCaller } from './helpers/api.js';
import { startTestApp } from './helpers/db.js';
import { newAccount, setLang, today } from './helpers/accounts.js';

// Amintirile tratamentelor: notificările pe telefon (expeditor fals) și rezumatul de seară pe email (sentMails),
// cu `now` fixat. Fiecare test își ia zilele lui (slot), ca rulările unui test să nu atingă tratamentele altuia.

let server;
let base;
let remind;
let one;
let all;
let dbRun;
let setPushSender;
let sentMails;
let atBucharest;
const call = apiCaller(() => ({ base }));

/** Ce a „trimis” expeditorul fals: { endpoint, payload }; răspunsul pe dispozitiv se alege din `answers`. */
const pushes = [];
const answers = new Map();

before(async () => {
  delete process.env.SMTP_URL;
  ({ server, base } = await startTestApp());
  ({ runTreatmentReminders: remind } = await import('../src/treatment-reminders.js'));
  ({ one, all, run: dbRun } = await import('../src/db.js'));
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
/** Ora României `hour`:`min` din ziua `date`. */
const at = (date, hour, min = 5) => new Date(atBucharest(date, hour).getTime() + min * 60_000);
let slot = 0;
/** O zi de început doar a testului acesta (la 20 de zile una de alta, după lanțul din primul test). */
const nextDay = () => addDays(today(), 30 + 20 * slot++);

let seq = 0;
async function account(name, { pigeons = 2, lang } = {}) {
  const cookie = await newAccount(call, name);
  const me = (await call('/api/auth/me', { cookie })).data.account;
  for (let i = 0; i < pigeons; i += 1) {
    seq += 1;
    const r = await call('/api/pigeons', { method: 'POST', cookie, body: { kind: 'own', ring: `RO-25-${600000 + seq}`, status: 'concurent' } });
    assert.equal(r.status, 201, JSON.stringify(r.data));
  }
  if (lang) await setLang(call, me.id, lang);
  return { cookie, id: me.id, email: me.email };
}

/** Un tratament salvat „demult” (înaintea oricărui moment din test), dacă nu se spune altfel. */
async function treatment(acc, o = {}) {
  const body = { name: 'tricomonaza', kind: 'tratament', method: 'apa', days: 3, target: 'toti', repeat: null, ...o };
  const r = await call('/api/treatments', { method: 'POST', cookie: acc.cookie, body });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  await dbRun(`UPDATE treatments SET created_at = '2020-01-01T00:00:00Z', updated_at = '2020-01-01T00:00:00Z' WHERE id = ?`, r.data.treatment.id);
  return r.data.treatment;
}

async function device(acc, n) {
  const endpoint = `https://fcm.googleapis.com/fcm/send/amintiri-${acc.id}-${n}`;
  const r = await call('/api/auth/push', { method: 'POST', cookie: acc.cookie, body: { endpoint, keys: { p256dh: 'p', auth: 'a' } } });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  return endpoint;
}

const pushesTo = (endpoint) => pushes.filter((p) => p.endpoint === endpoint);
const mailsTo = (acc) => sentMails.filter((m) => m.to === acc.email);

test('lanțul: copilul care începe azi se fixează și primește și el următorul (și la un cont doar-citire)', async () => {
  const a = await account('Lant');
  const b = await account('LantCitire');
  const ta = await treatment(a, { startDate: today(), repeat: { kind: 'zile', days: 7 } });
  const tb = await treatment(b, { startDate: today(), repeat: { kind: 'zile', days: 7 } });
  await dbRun('UPDATE accounts SET subscription_start = NULL, subscription_end = NULL WHERE id = ?', b.id);
  assert.equal((await call('/api/auth/me', { cookie: b.cookie })).data.account.subscription.active, false);
  const childOf = (id) => one('SELECT * FROM treatments WHERE parent_id = ?', id);
  const day7 = addDays(today(), 7);
  for (const tr of [ta, tb]) {
    const child = await childOf(tr.id);
    assert.equal(child.start_date, day7);
    assert.equal(child.frozen_at, null);
  }
  const r = await run(at(day7, 0, 30));
  assert.ok(r.frozen >= 2);
  for (const tr of [ta, tb]) {
    const child = await childOf(tr.id);
    assert.ok(child.frozen_at, 'copilul e fixat');
    assert.equal((await all('SELECT 1 FROM journal_entries WHERE treatment_id = ?', child.id)).length, 2);
    const grandchild = await childOf(child.id);
    assert.ok(grandchild, 'copilul are și el un următor');
    assert.equal(grandchild.start_date, addDays(today(), 14));
  }
});

test('repetarea: cu 3 zile înainte, la 19:00, cu ziua săptămânii', async () => {
  const a = await account('Repetare');
  const ep = await device(a, 1);
  const tr = await treatment(a, { startDate: today(), repeat: { kind: 'zile', days: 7 } });
  const child = await one('SELECT id, start_date FROM treatments WHERE parent_id = ?', tr.id);
  const weekday = new Intl.DateTimeFormat('ro-RO', { weekday: 'long', timeZone: 'UTC' }).format(new Date(`${child.start_date}T12:00:00Z`));
  await run(at(addDays(child.start_date, -3), 19));
  const got = pushesTo(ep);
  assert.equal(got.length, 1);
  assert.equal(got[0].payload.body, `${weekday[0].toUpperCase()}${weekday.slice(1)}: Tricomonază (gălbenele), 2 porumbei (în apă)`);
  assert.equal(got[0].payload.url, `/tratamente/${child.id}`);
});

test('„Mâine începe” la 19:05, o singură dată; numărul de porumbei și linkul la tratament', async () => {
  const d = nextDay();
  const a = await account('Maine');
  const ep = await device(a, 1);
  const tr = await treatment(a, { startDate: d });
  const r = await run(at(addDays(d, -1), 19));
  assert.ok(r.pushed >= 1);
  const got = pushesTo(ep);
  assert.equal(got.length, 1);
  assert.equal(got[0].payload.title, 'Porumbar');
  assert.equal(got[0].payload.body, 'Mâine începe: Tricomonază (gălbenele), 2 porumbei (în apă)');
  assert.equal(got[0].payload.url, `/tratamente/${tr.id}`);
  const notices = await all('SELECT kind, on_date FROM treatment_notices WHERE treatment_id = ?', tr.id);
  assert.deepEqual(notices, [{ kind: 'inainte', on_date: addDays(d, -1) }]);
  // A doua rulare cu același `now` (și cea de peste o oră, tot în fereastră): nimic nou.
  await run(at(addDays(d, -1), 19));
  await run(at(addDays(d, -1), 20));
  assert.equal(pushesTo(ep).length, 1);
  assert.equal(mailsTo(a).length, 0, 'are un dispozitiv care a primit: fără email');
});

test('rulări simultane: o singură notificare și un singur email pe cont', async () => {
  const d = nextDay();
  const a = await account('SimultanPush');
  const ep = await device(a, 1);
  answers.set(ep, 'error'); // dispozitivul rămâne, dar trimiterea serii eșuează → plasa de siguranță
  const b = await account('SimultanFara');
  await treatment(a, { startDate: d });
  await treatment(b, { startDate: d });
  const now = at(addDays(d, -1), 19);
  await Promise.all([run(now), run(now), run(now)]);
  assert.equal(pushesTo(ep).length, 1);
  assert.equal(mailsTo(a).length, 1);
  assert.equal(mailsTo(b).length, 1);
  assert.equal((await all('SELECT 1 FROM email_digests WHERE account_id IN (?, ?)', a.id, b.id)).length, 2);
});

test('două tratamente în același moment → o notificare cu amândouă, deschide Panoul', async () => {
  const d = nextDay();
  const a = await account('Doua');
  const ep = await device(a, 1);
  await treatment(a, { startDate: d });
  await treatment(a, { startDate: d, name: 'Vitamine', method: 'hrana', days: 1 });
  await run(at(addDays(d, -1), 19));
  const got = pushesTo(ep);
  assert.equal(got.length, 1);
  assert.equal(got[0].payload.url, '/panou');
  const lines = got[0].payload.body.split('\n').sort();
  assert.deepEqual(lines, ['Mâine începe: Tricomonază (gălbenele), 2 porumbei (în apă)', 'Mâine începe: Vitamine, 2 porumbei (în hrană)']);
});

test('fără dispozitive: un email seara, cu ambele tratamente, în limba contului; dimineața, niciunul', async () => {
  const d = nextDay();
  const a = await account('FaraHu', { lang: 'hu' });
  await treatment(a, { startDate: d, days: 2 });
  await treatment(a, { startDate: d, name: 'paramixo', kind: 'vaccin', method: 'injectie', days: 1 });
  const r = await run(at(addDays(d, -1), 19));
  assert.ok(r.emails >= 1);
  const mails = mailsTo(a);
  assert.equal(mails.length, 1);
  assert.equal(mails[0].subject, 'Porumbar: emlékeztető a kezelésekről');
  assert.match(mails[0].text, /Holnap kezdődik: .*, 2 galamb \(ivóvízbe\)/);
  assert.match(mails[0].text, /Holnap kezdődik: .*\(injekció\)/);
  assert.ok(mails[0].text.includes('http://localhost:3100/tratamente'), mails[0].text);
  assert.ok(mails[0].text.includes('mert a telefonodon az emlékeztetők nincsenek bekapcsolva (vagy nem érkeztek meg)'), mails[0].text);
  assert.ok(mails[0].text.includes('Fiók → Emlékeztetők'), mails[0].text);
  // A doua zi seara: „mâine e ultima zi” → încă un email (unul pe seară).
  await run(at(d, 19));
  assert.equal(mailsTo(a).length, 2);
  assert.match(mailsTo(a)[1].text, /Holnap van az utolsó nap/);
  // Dimineața ultimei zile: fără email.
  await run(at(addDays(d, 1), 7));
  assert.equal(mailsTo(a).length, 2);
});

test('singurul dispozitiv răspunde „gone”: abonamentul dispare și pleacă emailul', async () => {
  const d = nextDay();
  const a = await account('Gone');
  const ep = await device(a, 1);
  answers.set(ep, 'gone');
  await treatment(a, { startDate: d });
  await run(at(addDays(d, -1), 19));
  assert.equal(pushesTo(ep).length, 1);
  assert.equal((await all('SELECT 1 FROM push_subscriptions WHERE account_id = ?', a.id)).length, 0);
  assert.equal(mailsTo(a).length, 1);
  assert.match(mailsTo(a)[0].text, /Mâine începe: Tricomonază \(gălbenele\), 2 porumbei \(în apă\)/);
  assert.ok(
    mailsTo(a)[0].text.includes('Primești acest email pentru că pe telefonul tău amintirile nu sunt pornite (sau n-au ajuns). Le poți porni sau poți opri emailul din Cont → Amintiri.'),
    mailsTo(a)[0].text,
  );
  assert.ok(!mailsTo(a)[0].text.includes('nu au ajuns pe telefon'));
});

test('fără emailuri cerute (reminder_email = false) și fără dispozitive: niciun email', async () => {
  const d = nextDay();
  const a = await account('FaraEmail');
  await dbRun('UPDATE accounts SET reminder_email = false WHERE id = ?', a.id);
  await treatment(a, { startDate: d });
  await run(at(addDays(d, -1), 19));
  assert.equal(mailsTo(a).length, 0);
  assert.equal((await all('SELECT 1 FROM email_digests WHERE account_id = ?', a.id)).length, 0);
});

test('în producție fără SMTP_URL: niciun email și niciun rând în email_digests', async () => {
  const d = nextDay();
  const a = await account('Productie');
  await treatment(a, { startDate: d });
  const env = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try {
    await run(at(addDays(d, -1), 19));
  } finally {
    process.env.NODE_ENV = env;
  }
  assert.equal(mailsTo(a).length, 0);
  assert.equal((await all('SELECT 1 FROM email_digests WHERE account_id = ?', a.id)).length, 0);
});

test('un moment trecut cu mai mult de 3 ore (server oprit) nu se mai trimite', async () => {
  const d = nextDay();
  const a = await account('Tarziu');
  const ep = await device(a, 1);
  const tr = await treatment(a, { startDate: d });
  await run(at(addDays(d, -1), 22, 1));
  assert.equal(pushesTo(ep).length, 0);
  assert.equal((await all('SELECT 1 FROM treatment_notices WHERE treatment_id = ?', tr.id)).length, 0);
});

test('salvat la 19:30 pentru mâine: fără „Mâine începe” la 20:00; „ultima zi” vine normal', async () => {
  const d = nextDay();
  const a = await account('Seara');
  const ep = await device(a, 1);
  const tr = await treatment(a, { startDate: d, days: 2 });
  const saved = at(addDays(d, -1), 19, 30).toISOString();
  await dbRun('UPDATE treatments SET created_at = ?, updated_at = ? WHERE id = ?', saved, saved, tr.id);
  await run(at(addDays(d, -1), 20, 0));
  assert.equal(pushesTo(ep).length, 0);
  await run(at(addDays(d, 1), 7));
  const got = pushesTo(ep);
  assert.equal(got.length, 1);
  assert.equal(got[0].payload.body, 'Azi e ultima zi: Tricomonază (gălbenele)');
});

test('verificarea orară cade la hh:00:30, cel puțin o secundă mai târziu', async () => {
  const { msUntilNextTick } = await import('../src/treatment-reminders.js');
  const t = (iso) => msUntilNextTick(new Date(iso));
  assert.equal(t('2026-11-21T10:00:00.000Z'), 30_000);
  assert.equal(t('2026-11-21T10:00:30.000Z'), 3600e3, 'exact la hh:00:30: următoarea oră');
  assert.equal(t('2026-11-21T10:00:29.500Z'), 3600e3 + 500, 'mai puțin de o secundă: nu încă o rulare imediat');
  assert.equal(t('2026-11-21T10:00:31.000Z'), 3600e3 - 1000);
  assert.equal(t('2026-11-21T10:59:59.000Z'), 31_000);
  assert.equal(t('2026-11-21T10:41:00.000Z'), 19 * 60e3 + 30_000);
});

test('eroarea emailului nu ajunge în jurnal cu adresa omului', async () => {
  const { mailErrorText } = await import('../src/treatment-reminders.js');
  const e = Object.assign(new Error("Can't send mail - all recipients were rejected: 550 5.1.1 <om@exemplu.ro>: Recipient address rejected"), {
    code: 'EENVELOPE',
    responseCode: 550,
    response: '550 5.1.1 <om@exemplu.ro>: Recipient address rejected',
  });
  const out = mailErrorText(e);
  assert.ok(!out.includes('om@exemplu.ro'), out);
  assert.match(out, /EENVELOPE/);
  assert.match(out, /550/);
  assert.equal(typeof mailErrorText(new Error('x a@b.ro')), 'string');
  assert.ok(!mailErrorText(new Error('x a@b.ro')).includes('a@b.ro'));
});
