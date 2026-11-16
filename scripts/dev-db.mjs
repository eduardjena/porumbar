/*
 * npm run dev:db — un server PostgreSQL doar pentru dezvoltare, din programele PostgreSQL instalate pe calculator:
 * datele în data/pg, portul 5433, accesibil doar local. Nu atinge serviciul PostgreSQL instalat.
 * Prima dată creează clusterul și baza „porumbar” și scrie DATABASE_URL în .env; apoi doar îl pornește.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { findPostgresBin } from './lib/temp-postgres.mjs';

const EXE = process.platform === 'win32' ? '.exe' : '';
const ROOT = path.resolve(import.meta.dirname, '..');
const DATA = path.join(ROOT, 'data', 'pg');
const PORT = 5433;
const bin = findPostgresBin();
const tool = (name, args, opts = {}) => execFileSync(path.join(bin, `${name}${EXE}`), args, { stdio: 'ignore', timeout: 60_000, ...opts });

const fresh = !fs.existsSync(path.join(DATA, 'PG_VERSION'));
if (fresh) {
  fs.mkdirSync(DATA, { recursive: true });
  tool('initdb', ['-D', DATA, '-U', 'postgres', '-A', 'trust', '-E', 'UTF8', '--locale=C']);
}
let running = true;
try {
  tool('pg_ctl', ['-D', DATA, 'status']);
} catch {
  running = false;
}
if (!running) {
  tool('pg_ctl', ['-D', DATA, '-w', '-l', path.join(ROOT, 'data', 'pg.log'), '-o', `-p ${PORT} -c listen_addresses=127.0.0.1`, 'start']);
}
const psql = (sql) =>
  execFileSync(path.join(bin, `psql${EXE}`), ['-h', '127.0.0.1', '-p', String(PORT), '-U', 'postgres', '-d', 'postgres', '-tAc', sql], { encoding: 'utf8' }).trim();
if (psql("SELECT 1 FROM pg_database WHERE datname = 'porumbar'") !== '1') {
  psql(`CREATE DATABASE porumbar TEMPLATE template0 ENCODING 'UTF8' LOCALE_PROVIDER icu ICU_LOCALE 'ro-RO'`);
}

const url = `postgres://postgres@127.0.0.1:${PORT}/porumbar`;
const envFile = path.join(ROOT, '.env');
let env = fs.existsSync(envFile) ? fs.readFileSync(envFile, 'utf8') : '';
const line = `DATABASE_URL=${url}`;
if (!env.includes(line)) {
  env = /^DATABASE_URL=.*$/m.test(env) ? env.replace(/^DATABASE_URL=.*$/m, line) : `${env}${env && !env.endsWith('\n') ? '\n' : ''}${line}\n`;
  fs.writeFileSync(envFile, env);
}
console.log(`PostgreSQL de dezvoltare pornit pe portul ${PORT}. DATABASE_URL e în .env.`);
console.log('Oprire: pg_ctl -D data/pg stop');
