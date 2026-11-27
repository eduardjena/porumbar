import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { apiCaller } from './helpers/api.js';
import { startTestApp } from './helpers/db.js';
import { adminCookie, newAccount, today } from './helpers/accounts.js';

/*
 * Proba de 30 de zile: un singur porumbel iese din aplicație (pedigree-ul tipărit / PDF, codul QR), ales de om;
 * fără vânzare. După probă (fără plată): nimic nu se mai tipărește, linkurile pornite merg. Abonamentul expirat
 * tipărește în continuare (termenii o promit).
 */

let server;
let base;
const call = apiCaller(() => ({ base }));
before(async () => {
  ({ server, base } = await startTestApp());
});
after(() => server?.close());

let seq = 0;
const ring = () => `RO-26-${700000 + ++seq}`;
const create = async (cookie, extra = {}) => {
  const r = await call('/api/pigeons', { method: 'POST', cookie, body: { kind: 'own', ring: ring(), ...extra } });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  return r.data.pigeon;
};
const me = async (cookie) => (await call('/api/auth/me', { cookie })).data.account;
const pedigree = (cookie, id) => call(`/api/pigeons/${id}/pedigree`, { cookie });
const choose = (cookie, id) => call(`/api/pigeons/${id}/trial-pigeon`, { method: 'POST', cookie });
const endTrial = async (cookie) => {
  const { run } = await import('../src/db.js');
  await run("UPDATE accounts SET trial_end = (now() AT TIME ZONE 'Europe/Bucharest')::date - 1 WHERE id = ?", (await me(cookie)).id);
};

test('în probă: fără porumbel ales, pedigree-ul și QR-ul cer alegerea', async () => {
  const c = await newAccount(call, 'Proba', { trial: true });
  assert.equal((await me(c)).subscription.status, 'trial');
  const p = await create(c);
  const r = await pedigree(c, p.id);
  assert.equal(r.status, 402);
  assert.equal(r.data.key, 'eroare.proba_alege_porumbel');
  assert.equal((await call(`/api/pigeons/${p.id}/public`, { method: 'POST', cookie: c })).data.key, 'eroare.proba_alege_porumbel');
});

test('în probă: porumbelul ales iese (pedigree, QR), ceilalți nu; alegerea nu se schimbă', async () => {
  const c = await newAccount(call, 'Proba', { trial: true });
  const a = await create(c);
  const b = await create(c);
  assert.equal((await choose(c, a.id)).status, 200);
  assert.equal((await me(c)).trialPigeonId, a.id);
  assert.equal((await pedigree(c, a.id)).status, 200);
  assert.equal((await pedigree(c, a.id)).status, 200, 'același porumbel se tipărește de câte ori vrea');
  assert.equal((await call(`/api/pigeons/${a.id}/public`, { method: 'POST', cookie: c })).status, 200);
  assert.equal((await call(`/api/pigeons/${a.id}/public/new`, { method: 'POST', cookie: c })).status, 200);
  assert.equal((await call(`/api/sheets?ids=${a.id}`, { cookie: c })).status, 200);

  const rb = await pedigree(c, b.id);
  assert.equal(rb.status, 402);
  assert.equal(rb.data.key, 'eroare.proba_un_porumbel');
  assert.match(rb.data.error, /RO-26-/);
  assert.equal((await call(`/api/pigeons/${b.id}/public`, { method: 'POST', cookie: c })).status, 402);
  assert.equal((await call(`/api/sheets?ids=${a.id},${b.id}`, { cookie: c })).status, 402);
  assert.equal((await call('/api/sheets/public', { method: 'POST', cookie: c, body: { ids: [a.id, b.id] } })).status, 402);
  // A doua alegere: refuzată, primul rămâne.
  assert.equal((await choose(c, b.id)).status, 402);
  assert.equal((await choose(c, a.id)).status, 200);
  assert.equal((await me(c)).trialPigeonId, a.id);
});

test('în probă: porumbelul ales, rescris cu alt inel, nu mai iese; vânzătorul îl eliberează', async () => {
  const c = await newAccount(call, 'Proba', { trial: true });
  const a = await create(c);
  await choose(c, a.id);
  const patch = await call(`/api/pigeons/${a.id}`, { method: 'PATCH', cookie: c, body: { ring: ring() } });
  assert.equal(patch.status, 200, JSON.stringify(patch.data));
  const r = await pedigree(c, a.id);
  assert.equal(r.status, 402);
  assert.equal(r.data.key, 'eroare.proba_inel_schimbat');

  const id = (await me(c)).id;
  const admin = await adminCookie(call);
  const row = (await call(`/api/admin/accounts/${id}`, { cookie: admin })).data.account;
  assert.ok(row.trialPigeon);
  const rel = await call(`/api/admin/accounts/${id}/trial-pigeon`, { method: 'DELETE', cookie: admin });
  assert.equal(rel.status, 200);
  assert.equal(rel.data.account.trialPigeon, null);
  assert.equal((await choose(c, a.id)).status, 200);
  assert.equal((await pedigree(c, a.id)).status, 200);
});

test('în probă: vânzarea e oprită', async () => {
  const c = await newAccount(call, 'Proba', { trial: true });
  await newAccount(call, 'Cumpărător');
  const a = await create(c);
  await choose(c, a.id);
  const r = await call(`/api/pigeons/${a.id}/transfers`, { method: 'POST', cookie: c, body: { email: 'oricine@exemplu.test' } });
  assert.equal(r.status, 402);
  assert.equal(r.data.key, 'eroare.vanzare_fara_abonament');
});

test('după probă: nimic nu se mai tipărește, dar linkul pornit în probă merge', async () => {
  const c = await newAccount(call, 'Proba', { trial: true });
  const a = await create(c);
  await choose(c, a.id);
  const url = (await call(`/api/pigeons/${a.id}/public`, { method: 'POST', cookie: c })).data.url;
  await endTrial(c);
  assert.equal((await me(c)).subscription.status, 'trial-ended');
  const r = await pedigree(c, a.id);
  assert.equal(r.status, 402);
  assert.equal(r.data.key, 'eroare.tipar_fara_abonament');
  assert.equal((await call(`/api/sheets?ids=${a.id}`, { cookie: c })).status, 402);
  const token = url.split('/p/')[1];
  assert.equal((await call(`/api/public/${token}`, { auth: 'none' })).status, 200);
});

test('cu abonament plătit: tot; expirat: tipărește în continuare', async () => {
  const c = await newAccount(call, 'Platit');
  const a = await create(c);
  const b = await create(c);
  assert.equal((await pedigree(c, a.id)).status, 200);
  assert.equal((await pedigree(c, b.id)).status, 200);
  assert.equal((await call(`/api/sheets?ids=${a.id},${b.id}`, { cookie: c })).status, 200);
  const { run } = await import('../src/db.js');
  await run('UPDATE accounts SET subscription_end = ? WHERE id = ?', today(), (await me(c)).id);
  assert.equal((await me(c)).subscription.status, 'expired');
  assert.equal((await pedigree(c, b.id)).status, 200);
  assert.equal((await call(`/api/sheets?ids=${a.id},${b.id}`, { cookie: c })).status, 200);
});
