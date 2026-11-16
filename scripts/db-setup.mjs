/*
 * Pregătește baza de date locală pentru dezvoltare: npm run db:setup
 * Creează utilizatorul și baza „porumbar” în serverul PostgreSQL de pe acest calculator, cu o parolă generată,
 * și scrie DATABASE_URL în .env. Îți cere parola contului „postgres” (afișează steluțe; ajunge doar la psql, nu se salvează).
 * Se poate rula din nou: păstrează datele și schimbă doar parola utilizatorului aplicației.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { findPostgresBin } from './lib/temp-postgres.mjs';

const NAME = 'porumbar';
const HOST = process.env.PGHOST || 'localhost';
const PORT = process.env.PGPORT || '5432';
const ENV_FILE = path.resolve(import.meta.dirname, '..', '.env');

const password = crypto.randomBytes(24).toString('hex');
const sql = `
\\set ON_ERROR_STOP on
SELECT format('CREATE ROLE ${NAME} LOGIN PASSWORD %L', '${password}') WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${NAME}') \\gexec
ALTER ROLE ${NAME} LOGIN PASSWORD '${password}';
SELECT 'CREATE DATABASE ${NAME} OWNER ${NAME} TEMPLATE template0 ENCODING ''UTF8'' LOCALE_PROVIDER icu ICU_LOCALE ''ro-RO'''
  WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = '${NAME}') \\gexec
`;

// Comenzile (cu parola generată) stau într-un fișier temporar doar cât rulează psql.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'porumbar-db-setup-'));
const file = path.join(dir, 'setup.sql');
fs.writeFileSync(file, sql, { mode: 0o600 });
/** Citește parola de la tastatură; fiecare caracter apare ca steluță, ca să se vadă că tastarea merge. */
function askPassword(label) {
  return new Promise((resolve) => {
    process.stdout.write(label);
    let value = '';
    const { stdin } = process;
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    const onData = (chunk) => {
      for (const ch of chunk) {
        if (ch === '\r' || ch === '\n') {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.off('data', onData);
          process.stdout.write('\n');
          resolve(value);
          return;
        }
        if (ch === '\u0003') {
          fs.rmSync(dir, { recursive: true, force: true });
          process.stdout.write('\n');
          process.exit(1);
        }
        if (ch === '\b' || ch === '\u007f') {
          if (value) {
            value = [...value].slice(0, -1).join('');
            process.stdout.write('\b \b');
          }
        } else if (ch >= ' ') {
          value += ch;
          process.stdout.write('*');
        }
      }
    };
    stdin.on('data', onData);
  });
}

console.log(`PostgreSQL pe ${HOST}:${PORT}: scrie parola contului „postgres”, cea aleasă la instalare, apoi apasă Enter.\n`);
const exe = path.join(findPostgresBin(), process.platform === 'win32' ? 'psql.exe' : 'psql');
const ATTEMPTS = 5;
let status = 1;
for (let i = 1; i <= ATTEMPTS && status !== 0; i++) {
  const superPassword = await askPassword(`Parola (încercarea ${i} din ${ATTEMPTS}): `);
  status = spawnSync(exe, ['-w', '-h', HOST, '-p', PORT, '-U', 'postgres', '-d', 'postgres', '-q', '-f', file], {
    stdio: 'inherit',
    env: { ...process.env, PGPASSWORD: superPassword },
  }).status;
  if (status !== 0 && i < ATTEMPTS) console.log('\nNu a mers (eroarea e mai sus). Mai încearcă o dată.\n');
}
fs.rmSync(dir, { recursive: true, force: true });
if (status !== 0) {
  console.error('\nNu s-a creat nimic nou: psql a raportat o eroare (mai sus). Verifică parola și că serviciul PostgreSQL rulează.');
  process.exit(1);
}

const line = `DATABASE_URL=postgres://${NAME}:${password}@${HOST}:${PORT}/${NAME}`;
let env = fs.existsSync(ENV_FILE) ? fs.readFileSync(ENV_FILE, 'utf8') : '';
env = /^DATABASE_URL=.*$/m.test(env) ? env.replace(/^DATABASE_URL=.*$/m, line) : `${env}${env && !env.endsWith('\n') ? '\n' : ''}${line}\n`;
fs.writeFileSync(ENV_FILE, env);
console.log(`\nGata: baza „${NAME}” e pregătită, iar DATABASE_URL e în .env.`);
