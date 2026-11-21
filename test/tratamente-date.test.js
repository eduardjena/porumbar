import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { apiCaller } from './helpers/api.js';
import { startTestApp } from './helpers/db.js';
import { newAccount, setLang } from './helpers/accounts.js';

let server;
let base;
const call = apiCaller(() => ({ base }));
before(async () => {
  ({ server, base } = await startTestApp());
});
after(() => server?.close());

const COLUMNS = {
  treatments: ['id', 'account_id', 'name', 'kind', 'method', 'start_date', 'days', 'note', 'target', 'repeat_kind', 'repeat_days', 'parent_id', 'frozen_at', 'cancelled_on', 'created_at', 'updated_at'],
  treatment_pigeons: ['treatment_id', 'pigeon_id'],
  journal_entries: ['treatment_id'],
  push_subscriptions: ['id', 'account_id', 'endpoint', 'p256dh', 'auth', 'user_agent', 'created_at', 'last_ok_at'],
  treatment_notices: ['treatment_id', 'kind', 'on_date', 'sent_at'],
  email_digests: ['account_id', 'on_date', 'sent_at'],
  accounts: ['reminder_email'],
};

test('migrarea 22: versiunea din baza de date și tabelele / coloanele noi', async () => {
  const { SCHEMA_VERSION, one, all } = await import('../src/db.js');
  assert.ok(SCHEMA_VERSION >= 22);
  assert.equal((await one('SELECT version FROM schema_version')).version, SCHEMA_VERSION);
  for (const [table, cols] of Object.entries(COLUMNS)) {
    const rows = await all(`SELECT column_name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = ?`, table);
    const have = new Set(rows.map((r) => r.column_name));
    for (const c of cols) assert.ok(have.has(c), `${table}.${c} lipsește`);
  }
});

test('catalogul are metodele, destinatarii și sugestiile de tratament', async () => {
  const ro = (await call('/api/catalog', { auth: 'none' })).data;
  assert.deepEqual(ro.treatmentMethods.map((x) => x.code), ['apa', 'hrana', 'pastila', 'injectie', 'picaturi']);
  assert.deepEqual(ro.treatmentTargets.map((x) => x.code), ['toti', 'concurenti', 'reproducatori', 'tineret', 'alesi']);
  assert.ok(ro.treatmentSuggestions.length > 0);
  for (const list of [ro.treatmentMethods, ro.treatmentTargets, ro.treatmentSuggestions]) {
    for (const x of list) assert.ok(x.label && !x.label.startsWith('catalog.'), x.code);
  }

  const a = await newAccount(call, 'Ilona');
  const me = (await call('/api/auth/me', { cookie: a })).data.account;
  await setLang(call, me.id, 'hu');
  const hu = (await call('/api/catalog', { cookie: a })).data;
  for (const k of ['treatmentMethods', 'treatmentTargets', 'treatmentSuggestions']) {
    assert.deepEqual(hu[k].map((x) => x.code), ro[k].map((x) => x.code));
    ro[k].forEach((x, i) => assert.notEqual(hu[k][i].label, x.label, `${k}.${x.code} netradus`));
  }
});
