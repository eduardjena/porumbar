import { initDb } from './db.js';

/** Pregătește serverul: baza de date (cu migrările). */
export async function boot() {
  await initDb();
}
