import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { all, one, SCHEMA_VERSION } from './db.js';

/*
 * Copia de siguranță a bazei de date, descărcată de vânzător din consolă (POST /api/admin/backup).
 * Conținutul: toate tabelele (fiecare ca JSON, așa cum îl dă PostgreSQL, ca să revină exact la restaurare), fără ce e
 * doar de securitate și trecător (sesiunile, linkurile de parolă și de confirmare). Arhivat (gzip) și criptat
 * AES-256-GCM cu o cheie din parola BACKUP_PASSPHRASE (scrypt): fără parolă, fișierul nu se poate citi.
 * Restaurarea în Postgres-ul local: scripts/restaurare.mjs.
 */

/** Tabelele care nu intră în copie: sesiuni și linkuri de unică folosință (nu se restaurează; omul intră din nou). */
export const EXCLUDED_TABLES = new Set(['sessions', 'password_resets', 'email_confirmations', 'schema_version']);

const MAGIC = Buffer.from('PGRBK1');
const SCRYPT = { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

/** Parola copiilor: cel puțin 12 caractere, altfel copia nu se face. */
export const backupPassphrase = () => {
  const v = (process.env.BACKUP_PASSPHRASE || '').trim();
  return v.length >= 12 ? v : null;
};

const keyFrom = (passphrase, salt) => crypto.scryptSync(passphrase, salt, 32, SCRYPT);

/** MAGIC (6) · versiunea (1) · sarea (16) · iv (12) · eticheta GCM (16) · conținutul criptat. */
export function encrypt(plain, passphrase) {
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', keyFrom(passphrase, salt), iv);
  const body = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([MAGIC, Buffer.from([1]), salt, iv, cipher.getAuthTag(), body]);
}

export function decrypt(file, passphrase) {
  if (file.length < 51 || !file.subarray(0, 6).equals(MAGIC) || file[6] !== 1) throw new Error('Fișierul nu e o copie Pigeonrama.'); // i18n: ro
  const salt = file.subarray(7, 23);
  const iv = file.subarray(23, 35);
  const tag = file.subarray(35, 51);
  const decipher = crypto.createDecipheriv('aes-256-gcm', keyFrom(passphrase, salt), iv);
  decipher.setAuthTag(tag);
  try {
    return Buffer.concat([decipher.update(file.subarray(51)), decipher.final()]);
  } catch {
    throw new Error('Parola nu e bună sau fișierul e stricat.'); // i18n: ro
  }
}

/** Tabelele aplicației din baza curentă (schema public), în ordine alfabetică. */
export async function backupTables() {
  const rows = await all("SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename");
  return rows.map((r) => r.tablename).filter((t) => !EXCLUDED_TABLES.has(t));
}

/**
 * Copia: { app, schemaVersion, createdAt, tables: { nume: [rânduri JSON] } }, arhivată și criptată.
 * Întoarce și câte rânduri are fiecare tabel (pentru emailul către vânzător).
 */
export async function createBackup(passphrase) {
  const tables = {};
  const counts = {};
  for (const name of await backupTables()) {
    const { data } = await one(`SELECT coalesce(json_agg(t), '[]'::json)::text AS data FROM "${name}" t`);
    tables[name] = JSON.parse(data);
    counts[name] = tables[name].length;
  }
  const payload = { app: 'pigeonrama', schemaVersion: SCHEMA_VERSION, createdAt: new Date().toISOString(), tables };
  const gz = zlib.gzipSync(Buffer.from(JSON.stringify(payload)), { level: 9 });
  return { file: encrypt(gz, passphrase), counts };
}

/** Citirea copiei (pentru restaurare și teste): decriptată, dezarhivată, verificată. */
export function readBackup(file, passphrase) {
  const payload = JSON.parse(zlib.gunzipSync(decrypt(file, passphrase)).toString('utf8'));
  if (payload?.app !== 'pigeonrama' || typeof payload.tables !== 'object') throw new Error('Fișierul nu e o copie Pigeonrama.'); // i18n: ro
  return payload;
}
