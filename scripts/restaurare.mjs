/*
 * Restaurarea unei copii de siguranță Pigeonrama (fișierul .pgrb descărcat din consola vânzătorului) într-o bază
 * PostgreSQL GOALĂ, de obicei cea de pe calculator. Ce face:
 *   1. decriptează fișierul cu parola copiilor (BACKUP_PASSPHRASE; o cere dacă nu e în mediu);
 *   2. face tabelele în baza nouă (aceleași migrări ca aplicația);
 *   3. pune rândurile înapoi, exact cum erau, și potrivește numărătoarele (id-urile).
 *
 * Folosire (PowerShell), cu o bază goală făcută înainte (de ex. „createdb pigeonrama_restaurata”):
 *   $env:DATABASE_URL = "postgres://utilizator:parola@localhost:5432/pigeonrama_restaurata"
 *   node scripts/restaurare.mjs C:\Users\eu\Downloads\pigeonrama-copie-2026-11-27-1530.pgrb
 * Sesiunile nu sunt în copie: după restaurare, oamenii (și vânzătorul) intră din nou cu parola lor.
 */
import fs from 'node:fs';
import readline from 'node:readline/promises';
import pg from 'pg';

const file = process.argv[2];
if (!file || !fs.existsSync(file)) {
  console.error('Scrie calea fișierului: node scripts/restaurare.mjs <copia.pgrb>');
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error('Lipsește DATABASE_URL: adresa bazei GOALE în care se restaurează.');
  process.exit(1);
}

let passphrase = (process.env.BACKUP_PASSPHRASE || '').trim();
if (!passphrase) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  passphrase = (await rl.question('Parola copiilor (BACKUP_PASSPHRASE): ')).trim();
  rl.close();
}

const { readBackup } = await import('../src/backup.js');
let backup;
try {
  backup = readBackup(fs.readFileSync(file), passphrase);
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
console.log(`Copia din ${backup.createdAt}, schema ${backup.schemaVersion}.`);

// Tabelele, făcute de migrările aplicației (aceeași versiune a codului e cea mai sigură).
const { initDb, closeDb, SCHEMA_VERSION } = await import('../src/db.js');
if (backup.schemaVersion > SCHEMA_VERSION) {
  console.error(`Copia are schema ${backup.schemaVersion}, mai nouă decât acest cod (${SCHEMA_VERSION}). Actualizează codul (git pull) și încearcă din nou.`);
  process.exit(1);
}
if (backup.schemaVersion < SCHEMA_VERSION) {
  console.warn(`Atenție: copia are schema ${backup.schemaVersion}, codul are ${SCHEMA_VERSION}. Rândurile se pun în tabelele noi; coloanele noi rămân cu valoarea implicită.`);
}
await initDb();
await closeDb();

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  const { rows } = await client.query('SELECT count(*)::int AS n FROM accounts');
  if (rows[0].n > 0 && !process.argv.includes('--peste')) {
    throw new Error('Baza nu e goală (are conturi). Restaurează într-o bază nouă, goală (sau adaugă --peste ca să o înlocuiești).');
  }
  await client.query('BEGIN');
  // Ordinea: întâi tabelele la care trimit altele (conturile înaintea porumbeilor etc.).
  const edges = (await client.query(`
    SELECT conrelid::regclass::text AS child, confrelid::regclass::text AS parent
      FROM pg_constraint WHERE contype = 'f' AND conrelid <> confrelid`)).rows.map((e) => [e.child.replace(/"/g, ''), e.parent.replace(/"/g, '')]);
  const names = [];
  const pending = new Set(Object.keys(backup.tables));
  while (pending.size) {
    const ready = [...pending].filter((t) => !edges.some(([c, p]) => c === t && pending.has(p) && p !== t));
    const next = ready.length ? ready : [...pending]; // o buclă între tabele (nu ar trebui): le punem cum vin
    for (const t of next) { names.push(t); pending.delete(t); }
  }
  // Golite toate, apoi umplute în ordinea de mai sus (legăturile dintr-un tabel spre el însuși se verifică la final).
  await client.query(`TRUNCATE ${names.map((n) => `"${n}"`).join(', ')} CASCADE`);
  for (const name of names) {
    const rowsOf = backup.tables[name];
    if (!rowsOf.length) continue;
    // PostgreSQL face singur tipurile la loc (date, JSON, liste, octeți) din JSON-ul dat de el la copiere.
    await client.query(`INSERT INTO "${name}" SELECT * FROM json_populate_recordset(NULL::"${name}", $1::json)`, [JSON.stringify(rowsOf)]);
    console.log(`  ${name}: ${rowsOf.length}`);
  }
  // Numărătoarele (id-urile): următorul id după cel mai mare restaurat.
  const seqs = await client.query(`
    SELECT c.relname AS tbl, a.attname AS col, pg_get_serial_sequence(quote_ident(c.relname), a.attname) AS seq
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace JOIN pg_attribute a ON a.attrelid = c.oid
     WHERE n.nspname = 'public' AND c.relkind = 'r' AND a.attnum > 0 AND pg_get_serial_sequence(quote_ident(c.relname), a.attname) IS NOT NULL`);
  for (const { tbl, col, seq } of seqs.rows) {
    await client.query(`SELECT setval($1, coalesce((SELECT max("${col}") FROM "${tbl}"), 0) + 1, false)`, [seq]);
  }
  await client.query('COMMIT');
  console.log('Gata: copia e restaurată.');
} catch (e) {
  await client.query('ROLLBACK').catch(() => {});
  console.error(e.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
