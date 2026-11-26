import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { apiCaller } from './helpers/api.js';
import { startTestApp } from './helpers/db.js';
import { adminCookie, confirmAndEnter, confirmEmail, today } from './helpers/accounts.js';
import { plusDays, TERMS_VERSION } from '../src/subscriptions.js';

let server;
let base;
const call = apiCaller(() => ({ base }));
before(async () => {
  ({ server, base } = await startTestApp());
});
after(() => server?.close());

const PASS = 'parola-de-test-123';
const reg = (email, extra = {}) => call('/api/auth/register', { method: 'POST', auth: 'none', body: { email, password: PASS, name: 'Ion Popescu', acceptTerms: true, country: 'RO', phone: '0700 000 000', city: 'Brașov', ...extra } });
const mailsTo = async (email) => (await import('../src/mail.js')).sentMails.filter((m) => m.to === email);
const tokenOf = async (email) => (await mailsTo(email)).at(-1).text.match(/\/confirma\/(\S+)/)[1];

test('fără acceptTerms: 400 și contul nu se face', async () => {
  const email = 'fara-termeni@exemplu.test';
  const r = await call('/api/auth/register', { method: 'POST', auth: 'none', body: { email, password: PASS, name: 'Ion' } });
  assert.equal(r.status, 400);
  const r2 = await reg(email, { acceptTerms: 'true' });
  assert.equal(r2.status, 400);
  const { one } = await import('../src/db.js');
  assert.equal(await one('SELECT 1 FROM accounts WHERE email = ?', email), undefined);
});

test('cu acceptTerms: termenii, numele pe fișă, neconfirmat și emailul de confirmare', async () => {
  const email = 'cu-termeni@exemplu.test';
  const r = await reg(email);
  assert.equal(r.status, 201);
  assert.equal(r.data.account.pedigreeName, 'Ion Popescu');
  assert.equal(r.data.account.subscription.status, 'unconfirmed');
  const { one } = await import('../src/db.js');
  assert.equal((await one('SELECT terms_version, terms_accepted_at FROM accounts WHERE email = ?', email)).terms_version, TERMS_VERSION);
  const mails = await mailsTo(email);
  assert.equal(mails.length, 1);
  assert.match(mails[0].text, /\/confirma\/\S+/);
});

test('câmpul-capcană „website”: 201, dar fără cont și fără email', async () => {
  const email = 'robot@exemplu.test';
  const r = await reg(email, { website: 'http://spam.example' });
  assert.equal(r.status, 201);
  const { one } = await import('../src/db.js');
  assert.equal(await one('SELECT 1 FROM accounts WHERE email = ?', email), undefined);
  assert.equal((await mailsTo(email)).length, 0);
});

test('email de unică folosință: 400', async () => {
  // Cu punct la final (numele de domeniu complet, „mailinator.com.”) e tot același domeniu.
  for (const email of ['cineva@mailinator.com', 'cineva@sub.mailinator.com', 'CINEVA@Mailinator.COM', 'x@mailinator.com.', 'x@mailinator.com..']) {
    const r = await reg(email);
    assert.equal(r.status, 400, email);
    assert.match(JSON.stringify(r.data), /unică folosință/);
  }
  const { isDisposableEmail } = await import('../src/disposable.js');
  assert.equal(isDisposableEmail('x@exemplu.test'), false);
  assert.equal(isDisposableEmail('x@gmail.com'), false);
  assert.equal(isDisposableEmail('x@yopmail.com'), true);
  assert.equal(isDisposableEmail('x@yopmail.com.'), true);
  assert.equal(isDisposableEmail('x@gmail.com.'), false);
});

test('confirmarea pornește proba; același token a doua oară: 400, proba neschimbată', async () => {
  const email = 'confirm@exemplu.test';
  await reg(email);
  const token = await tokenOf(email);
  const r = await call('/api/auth/confirm', { method: 'POST', auth: 'none', body: { token } });
  assert.equal(r.status, 200);
  assert.equal(r.data.account.subscription.status, 'trial');
  assert.equal(r.data.account.subscription.trialEnd, plusDays(today(), 30));
  const { run, one } = await import('../src/db.js');
  await run("UPDATE accounts SET trial_end = trial_end + 1 WHERE email = ?", email);
  const again = await call('/api/auth/confirm', { method: 'POST', auth: 'none', body: { token } });
  assert.equal(again.status, 400);
  assert.match(JSON.stringify(again.data), /Linkul a expirat/);
  const row = await one('SELECT trial_end::text AS t FROM accounts WHERE email = ?', email);
  assert.equal(row.t, plusDays(today(), 31), 'nu s-a atins');
  const ev = await one("SELECT 1 FROM account_events e JOIN accounts a ON a.id = e.account_id WHERE a.email = ? AND e.kind = 'confirmed'", email);
  assert.ok(ev);
});

test('tokenul mai vechi de 7 zile nu merge', async () => {
  const email = 'vechi@exemplu.test';
  await reg(email);
  const token = await tokenOf(email);
  const { run } = await import('../src/db.js');
  await run("UPDATE email_confirmations SET expires_at = now() - interval '1 minute' WHERE account_id = (SELECT id FROM accounts WHERE email = ?)", email);
  const r = await call('/api/auth/confirm', { method: 'POST', auth: 'none', body: { token } });
  assert.equal(r.status, 400);
  // Tot neconfirmat: nu poate intra.
  const login = await call('/api/auth/login', { method: 'POST', auth: 'none', body: { email, password: PASS } });
  assert.equal(login.status, 403);
  assert.equal(login.data.key, 'eroare.email_neconfirmat');
});

test('„Trimite din nou”: email nou, tokenul vechi nu mai merge', async () => {
  const email = 'din-nou@exemplu.test';
  const r = await reg(email);
  assert.equal(r.res.headers.get('set-cookie'), null, 'înscrierea nu face sesiune');
  const old = await tokenOf(email);
  // „Trimite din nou” merge fără cont intrat, după email; același răspuns pentru un email necunoscut.
  const s = await call('/api/auth/confirm/resend', { method: 'POST', auth: 'none', body: { email } });
  assert.equal(s.status, 200);
  assert.deepEqual(s.data, { ok: true });
  assert.equal((await mailsTo(email)).length, 2);
  assert.equal((await call('/api/auth/confirm', { method: 'POST', auth: 'none', body: { token: old } })).status, 400);
  const cookie = await confirmAndEnter(call, email);
  assert.equal((await call('/api/auth/me', { cookie })).data.account.subscription.status, 'trial');
  const unknown = await call('/api/auth/confirm/resend', { method: 'POST', auth: 'none', body: { email: 'nimeni-aici@exemplu.test' } });
  assert.deepEqual(unknown.data, { ok: true });
  assert.equal((await mailsTo('nimeni-aici@exemplu.test')).length, 0);
});

test('contul făcut din consolă e confirmat, cu probă de 30 de zile', async () => {
  const cookie = await adminCookie(call);
  const r = await call('/api/admin/accounts', { method: 'POST', cookie, body: { name: 'Din Consolă', email: 'consola@exemplu.test' } });
  assert.equal(r.status, 201);
  const me = (await call(`/api/admin/accounts/${r.data.account.id}`, { cookie })).data.account;
  assert.equal(me.status, 'trial');
  const { one } = await import('../src/db.js');
  assert.equal((await one('SELECT trial_end::text AS t FROM accounts WHERE id = ?', r.data.account.id)).t, plusDays(today(), 30));
});

test('contul din consolă cu „activate”: activ, fără probă', async () => {
  const cookie = await adminCookie(call);
  const r = await call('/api/admin/accounts', { method: 'POST', cookie, body: { name: 'Plătit', sheetName: 'Plătit', email: 'platit@exemplu.test', activate: true, start: today() } });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  assert.equal(r.data.account.status, 'active');
  const { one } = await import('../src/db.js');
  assert.equal((await one('SELECT trial_end FROM accounts WHERE id = ?', r.data.account.id)).trial_end, null);
});

test('țara: obligatorie, doar un cod cunoscut; se păstrează în cont', async () => {
  for (const country of [undefined, '', 'XX', 'Romania', 'R0']) {
    const r = await reg(`tara-${String(country)}@exemplu.test`, { country });
    assert.equal(r.status, 400, String(country));
    assert.match(JSON.stringify(r.data), /țara/i);
  }
  const ok = await reg('tara-jp@exemplu.test', { country: 'jp' });
  assert.equal(ok.status, 201, JSON.stringify(ok.data));
  assert.equal(ok.data.account.country, 'JP');
});

test('vânzătorul primește mailul o singură dată, la prima confirmare (nu la înscriere)', async () => {
  const { sentMails } = await import('../src/mail.js');
  const email = 'vanzator-afla@exemplu.test';
  const before = sentMails.length;
  assert.equal((await reg(email)).status, 201);
  const toSeller = () => sentMails.slice(before).filter((m) => m.to === process.env.ADMIN_EMAIL);
  assert.equal(toSeller().length, 0);
  await confirmEmail(call, email);
  assert.equal(toSeller().length, 1);
  assert.ok(toSeller()[0].text.includes(email) && toSeller()[0].text.includes('RO'));
});

test('linkul de parolă nouă confirmă și emailul (a venit pe email) și pornește proba', async () => {
  const { sentMails } = await import('../src/mail.js');
  const email = 'parola-confirma@exemplu.test';
  assert.equal((await reg(email)).status, 201);
  await call('/api/auth/forgot', { method: 'POST', auth: 'none', body: { email } });
  const token = sentMails.filter((m) => m.to === email).at(-1).text.match(/\/parola-noua\/(\S+)/)[1];
  const r = await call('/api/auth/reset', { method: 'POST', auth: 'none', body: { token, password: 'parola-noua-de-test-1' } });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.account.subscription.status, 'trial');
});

test('în probă: 3 citiri din poză (numărate de la confirmare); neconfirmat: niciuna', async () => {
  const email = 'citiri-proba@exemplu.test';
  await reg(email);
  const cookie = await confirmAndEnter(call, email);
  const me = async () => (await call('/api/auth/me', { cookie })).data.account;
  const a = await me();
  assert.equal(a.subscription.status, 'trial');
  assert.equal(a.reads.allowed, 3);
  assert.equal(a.reads.used, 0);
});

test('telefonul și localitatea: obligatorii, telefonul cu cel puțin 6 cifre; ajung în cont (localitatea = adresa de pe fișă) și la vânzător', async () => {
  for (const [extra, re] of [[{ phone: '' }, /telefon/i], [{ phone: '12-34' }, /telefon/i], [{ city: '' }, /localitate/i], [{ city: undefined }, /localitate/i]]) {
    const r = await reg(`tel-${JSON.stringify(extra).replace(/\W/g, '')}@exemplu.test`, extra);
    assert.equal(r.status, 400, JSON.stringify(extra));
    assert.match(JSON.stringify(r.data), re);
  }
  const { sentMails } = await import('../src/mail.js');
  const email = 'tel-ok@exemplu.test';
  const before = sentMails.length;
  const ok = await reg(email, { phone: '+40 722 123 456', city: 'Cluj-Napoca' });
  assert.equal(ok.status, 201, JSON.stringify(ok.data));
  assert.equal(ok.data.account.phone, '+40 722 123 456');
  assert.equal(ok.data.account.address, 'Cluj-Napoca');
  await confirmEmail(call, email);
  const toSeller = sentMails.slice(before).filter((m) => m.to === process.env.ADMIN_EMAIL);
  assert.ok(toSeller[0].text.includes('+40 722 123 456') && toSeller[0].text.includes('Cluj-Napoca'));
});

test('telefonul: mesajul spune câte cifre a numărat; cifrele japoneze (０-９) se numără; emailul folosit are cheia lui', async () => {
  const short = await reg('tel-scurt@exemplu.test', { phone: '0722 1' });
  assert.equal(short.status, 400);
  assert.equal(short.data.key, 'eroare.telefon_gresit');
  assert.match(short.data.error, /6 cifre; cel scris are 5/);
  const jp = await reg('tel-jp@exemplu.test', { phone: '０９０－１２３４－５６７８', country: 'JP' });
  assert.equal(jp.status, 201, JSON.stringify(jp.data));
  const again = await reg('tel-jp@exemplu.test');
  assert.equal(again.status, 409);
  assert.equal(again.data.key, 'eroare.email_exista');
  assert.match(again.data.error, /deja folosită/);
});

test('un cont neconfirmat nu intră: nici cu parola, nici cu o sesiune mai veche (de dinainte de regulă)', async () => {
  const email = 'sesiune-veche@exemplu.test';
  await reg(email);
  const cookie = await confirmAndEnter(call, email);
  assert.equal((await call('/api/auth/me', { cookie })).status, 200);
  // Ca un cont făcut înainte de regulă: sesiune deschisă, email neconfirmat.
  const { run } = await import('../src/db.js');
  await run('UPDATE accounts SET email_confirmed_at = NULL WHERE email = ?', email);
  const me = await call('/api/auth/me', { cookie });
  assert.equal(me.status, 401);
  assert.equal(me.data.key, 'eroare.email_neconfirmat');
  const login = await call('/api/auth/login', { method: 'POST', auth: 'none', body: { email, password: PASS } });
  assert.equal(login.status, 403);
  assert.equal(login.data.key, 'eroare.email_neconfirmat');
});
