import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { apiCaller } from './helpers/api.js';
import { startTestApp } from './helpers/db.js';
import { newAccount } from './helpers/accounts.js';

/*
 * Rândurile salvate înainte de „inelele din toată lumea”: strămoși cu un inel pe care parserul vechi nu-l citea
 * (ring_key NULL). La pornire primesc cheia, o singură dată, fără migrare numerotată (src/ring-backfill.js).
 */
let server;
let base;
let db;
let backfill;
const call = apiCaller(() => ({ base }));
before(async () => {
  ({ server, base } = await startTestApp());
  db = await import('../src/db.js');
  ({ backfillRingKeys: backfill } = await import('../src/ring-backfill.js'));
});
after(() => server?.close());

const oldRow = (accountId, kind, ring, name = null) =>
  db.insert(`INSERT INTO pigeons (account_id, kind, ring_raw, name, search_text, created_at, updated_at) VALUES (?, ?, ?, ?, ?, now(), now())`,
    accountId, kind, ring, name, ring.toLowerCase());

test('inelele vechi recunoscute acum primesc cheia; o dublură rămâne neatinsă; a doua rulare nu schimbă nimic', async () => {
  const a = await newAccount(call, 'Vechi');
  const me = (await call('/api/auth/me', { cookie: a })).data.account;
  const au = await oldRow(me.id, 'external', 'AU 18 RMR 18861', 'Vechiul american');
  const gb1 = await oldRow(me.id, 'external', 'GB22T12345');
  const gb2 = await oldRow(me.id, 'external', 'GB-2022-T-12345');
  const odd = await oldRow(me.id, 'external', 'Latebred BasVK??');
  const already = (await call('/api/pigeons', { method: 'POST', cookie: a, body: { kind: 'external', ring: 'NL-21-1234567' } })).data.pigeon;
  const before = await db.one('SELECT ring_key, updated_at FROM pigeons WHERE id = ?', already.id);

  const first = await backfill();
  assert.ok(first.filled >= 2, JSON.stringify(first));
  const row = (id) => db.one('SELECT ring_key, ring_country, ring_year, ring_club, ring_number, search_text FROM pigeons WHERE id = ?', id);
  assert.deepEqual({ ...(await row(au)), search_text: undefined }, {
    ring_key: 'AU|2018|RMR|18861', ring_country: 'AU', ring_year: 2018, ring_club: 'RMR', ring_number: '18861', search_text: undefined,
  });
  assert.match((await row(au)).search_text, /au-18-rmr-18861/i);
  assert.equal((await row(gb1)).ring_key, 'GB|2022|T|12345');
  assert.equal((await row(gb2)).ring_key, null, 'ar dubla strămoșul gb1: rămâne cum era');
  assert.equal((await row(odd)).ring_key, null, 'nerecunoscut: rămâne fără cheie');
  assert.deepEqual(await db.one('SELECT ring_key, updated_at FROM pigeons WHERE id = ?', already.id), before, 'cheile existente nu se ating');

  const snapshot = await db.all('SELECT id, ring_key, search_text FROM pigeons WHERE account_id = ? ORDER BY id', me.id);
  const second = await backfill();
  assert.equal(second.filled, 0);
  assert.deepEqual(await db.all('SELECT id, ring_key, search_text FROM pigeons WHERE account_id = ? ORDER BY id', me.id), snapshot);

  // Acum căutarea după inel îl găsește, scris în altă formă, iar porumbelul propriu cu același inel îl preia.
  const look = await call(`/api/pigeons/lookup?ring=${encodeURIComponent('AU-2018-RMR-18861')}`, { cookie: a });
  assert.deepEqual(look.data.matches.map((m) => m.pigeon.id), [au]);
  const mine = await call('/api/pigeons', { method: 'POST', cookie: a, body: { kind: 'own', ring: '18861 RMR AU 2018' } });
  assert.equal(mine.status, 201, JSON.stringify(mine.data));
  assert.equal(mine.data.pigeon.id, au, 'strămoșul devine porumbelul propriu, nu o dublură');
});
