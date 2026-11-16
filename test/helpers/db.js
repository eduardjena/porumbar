// Fiecare fișier de teste primește propria bază de date și propriul director de date, șterse la sfârșitul procesului.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import pg from 'pg';
import { createDatabase } from '../../scripts/lib/temp-postgres.mjs';

/** Se apelează în `before`, după ce testul și-a setat variabilele de mediu și înainte de orice import din aplicație. */
export async function bootTestDb() {
  // Adminul de test se face la pornire (src/boot.js), deci setările lui trebuie să existe înainte.
  process.env.ADMIN_EMAIL ??= 'admin@porumbar.test';
  process.env.ADMIN_PASSWORD ??= 'parola-admin-de-test-123';
  const admin = process.env.TEST_DATABASE_URL;
  if (!admin) throw new Error('Testele se rulează cu „npm test” (sau cu TEST_DATABASE_URL setat).');
  const name = `porumbar_test_${process.pid}_${crypto.randomBytes(4).toString('hex')}`;
  process.env.DATABASE_URL = await createDatabase(admin, name);
  const tempData = process.env.DATA_DIR ? null : fs.mkdtempSync(path.join(os.tmpdir(), 'porumbar-test-'));
  if (tempData) process.env.DATA_DIR = tempData;

  process.once('beforeExit', async () => {
    const { closeDb } = await import('../../src/db.js');
    await closeDb();
    const client = new pg.Client({ connectionString: admin });
    await client.connect();
    await client.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
    await client.end();
    if (tempData) fs.rmSync(tempData, { recursive: true, force: true, maxRetries: 3 });
  });

  const { boot } = await import('../../src/boot.js');
  await boot();
}

/** Pornește aplicația de test: bază nouă + server pe un port liber. */
export async function startTestApp() {
  await bootTestDb();
  const { createApp } = await import('../../src/app.js');
  const { listen } = await import('./api.js');
  return listen(createApp());
}
