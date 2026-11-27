import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { apiCaller } from './helpers/api.js';
import { startTestApp } from './helpers/db.js';
import { adminCookie, newAccount } from './helpers/accounts.js';
import { createDatabase } from '../scripts/lib/temp-postgres.mjs';

// Copia de siguranță din consola vânzătorului: doar vânzătorul, cu parola din nou, criptată, fără sesiuni; se
// restaurează întreagă într-o bază goală (scripts/restaurare.mjs).
process.env.BACKUP_PASSPHRASE = 'parola-copiilor-de-test-123';

let server;
let base;
let mailMod;
const call = apiCaller(() => ({ base }));
before(async () => {
  ({ server, base } = await startTestApp());
  mailMod = await import('../src/mail.js');
});
after(() => server?.close());

const backup = (cookie, password) => call('/api/admin/backup', { method: 'POST', cookie, body: { password } });

test('doar vânzătorul, doar cu parola lui; altfel nimic', async () => {
  const breeder = await newAccount(call, 'Curios');
  assert.equal((await backup(breeder, 'parola-de-test-123')).status, 403);
  const admin = await adminCookie(call);
  const wrong = await backup(admin, 'nu-e-parola');
  assert.equal(wrong.status, 403);
  assert.equal((await call('/api/admin/backup', { cookie: admin })).data.ready, true);
});

test('fără parola copiilor pe server, copia nu se face (nu există copii necriptate)', async () => {
  const admin = await adminCookie(call);
  const saved = process.env.BACKUP_PASSPHRASE;
  process.env.BACKUP_PASSPHRASE = 'scurta';
  try {
    assert.equal((await call('/api/admin/backup', { cookie: admin })).data.ready, false);
    assert.equal((await backup(admin, process.env.ADMIN_PASSWORD)).status, 409);
  } finally {
    process.env.BACKUP_PASSPHRASE = saved;
  }
});

test('copia: criptată, cu toate datele, fără sesiuni; vânzătorul primește email; se restaurează întreagă', async () => {
  const c = await newAccount(call, 'Copiat');
  const created = await call('/api/pigeons', { method: 'POST', cookie: c, body: { kind: 'own', ring: 'RO-26-555001', name: 'Salvat', lines: ['Janssen'] } });
  assert.equal(created.status, 201, JSON.stringify(created.data));
  const admin = await adminCookie(call);
  const mails = mailMod.sentMails.length;
  const r = await backup(admin, process.env.ADMIN_PASSWORD);
  assert.equal(r.status, 200);
  assert.match(r.res.headers.get('content-disposition'), /attachment; filename="pigeonrama-copie-.*\.pgrb"/);
  assert.equal(r.buf.subarray(0, 6).toString(), 'PGRBK1');
  assert.ok(!r.buf.includes(Buffer.from('RO-26-555001')), 'criptată: inelul nu se vede în fișier');

  const { readBackup } = await import('../src/backup.js');
  assert.throws(() => readBackup(r.buf, 'alta-parola-gresita'), /Parola nu e bună/);
  const data = readBackup(r.buf, process.env.BACKUP_PASSPHRASE);
  assert.ok(data.tables.accounts.some((a) => a.name.startsWith('Copiat')));
  assert.ok(data.tables.pigeons.some((p) => p.ring_raw === 'RO-26-555001'));
  for (const t of ['sessions', 'password_resets', 'email_confirmations']) assert.equal(data.tables[t], undefined, t);
  await new Promise((res) => setTimeout(res, 50));
  assert.ok(mailMod.sentMails.slice(mails).some((m) => m.to === process.env.ADMIN_EMAIL && /copie de siguranță/.test(m.subject)));

  // Restaurarea, într-o bază nouă și goală.
  const fs = await import('node:fs');
  const os = await import('node:os');
  const file = path.join(os.tmpdir(), `copie-${process.pid}.pgrb`);
  fs.writeFileSync(file, r.buf);
  const target = await createDatabase(process.env.TEST_DATABASE_URL, `porumbar_restaurare_${process.pid}`);
  const run = spawnSync(process.execPath, ['scripts/restaurare.mjs', file], {
    cwd: path.resolve(import.meta.dirname, '..'),
    env: { ...process.env, DATABASE_URL: target },
    encoding: 'utf8',
  });
  fs.rmSync(file, { force: true });
  assert.equal(run.status, 0, run.stderr + run.stdout);
  const pg = (await import('pg')).default;
  const client = new pg.Client({ connectionString: target });
  await client.connect();
  try {
    const pig = await client.query("SELECT name, lines FROM pigeons WHERE ring_raw = 'RO-26-555001'");
    assert.equal(pig.rows[0].name, 'Salvat');
    assert.deepEqual(pig.rows[0].lines, ['Janssen']);
    const counts = await client.query('SELECT (SELECT count(*)::int FROM accounts) AS a, (SELECT count(*)::int FROM pigeons) AS p');
    assert.equal(counts.rows[0].a, data.tables.accounts.length);
    assert.equal(counts.rows[0].p, data.tables.pigeons.length);
    // Numărătoarea merge mai departe: un porumbel nou primește un id după cele restaurate.
    const ins = await client.query("INSERT INTO pigeons (account_id, kind, name, created_at, updated_at) SELECT id, 'own', 'Nou', now(), now() FROM accounts LIMIT 1 RETURNING id");
    assert.ok(ins.rows[0].id > Math.max(...data.tables.pigeons.map((p) => p.id)));
  } finally {
    await client.end();
    const admin2 = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL });
    await admin2.connect();
    await admin2.query(`DROP DATABASE IF EXISTS "porumbar_restaurare_${process.pid}" WITH (FORCE)`);
    await admin2.end();
  }
});
