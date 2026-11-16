import fs from 'node:fs';
import path from 'node:path';
import { initDb } from './db.js';
import { config } from './config.js';

/** Pregătește serverul: baza de date (cu migrările) și curățenia pe disc. */
export async function boot() {
  await initDb();
  // Pozele porumbeilor au fost scoase (migrarea 5, decizia utilizatorului: fără spațiu pe server pentru poze).
  // Fișierele rămase de la versiunea veche se șterg, ca să nu ocupe spațiu degeaba.
  fs.rmSync(path.resolve(config.dataDir, 'photos'), { recursive: true, force: true });
}
