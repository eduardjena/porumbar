import fs from 'node:fs';
import path from 'node:path';
import { initDb, one, insert, nowIso } from './db.js';
import { hashPassword } from './accounts.js';
import { config } from './config.js';

/** Pregătește serverul: baza de date (cu migrările) și curățenia pe disc. */
export async function boot() {
  await initDb();
  // Pozele porumbeilor au fost scoase (migrarea 5, decizia utilizatorului: fără spațiu pe server pentru poze).
  // Fișierele rămase de la versiunea veche se șterg, ca să nu ocupe spațiu degeaba.
  fs.rmSync(path.resolve(config.dataDir, 'photos'), { recursive: true, force: true });
  await ensureAdmin();
}

/**
 * Contul vânzătorului (singurul admin): se face la pornire din ADMIN_EMAIL + ADMIN_PASSWORD, dacă nu există.
 * Parola din setări e doar pentru prima intrare; apoi se schimbă cu „Am uitat parola”. Formularul de cont nou
 * refuză emailul de admin.
 */
async function ensureAdmin() {
  const email = config.adminEmail;
  if (!email) return;
  if (await one('SELECT 1 FROM accounts WHERE lower(email) = lower(?)', email)) return;
  const password = process.env.ADMIN_PASSWORD || '';
  if (password.length < 10) {
    console.warn('[porumbar] ADMIN_EMAIL e setat, dar contul de admin nu există: pune și ADMIN_PASSWORD (cel puțin 10 caractere) și repornește.');
    return;
  }
  await insert('INSERT INTO accounts (email, name, password_hash, created_at) VALUES (?, ?, ?, ?)', email, 'Vânzătorul', await hashPassword(password), nowIso());
  console.log(`[porumbar] Contul de admin ${email} a fost creat.`);
}
