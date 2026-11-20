import { all, one, run } from './db.js';
import { fold } from './catalog.js';
import { formatRing, parseRing, ringKey } from './rings.js';

/*
 * Inelele salvate înainte de „inelele din toată lumea” (2026-11-20): strămoșii cu un inel pe care parserul vechi nu-l
 * citea au ring_key NULL. Acum multe se recunosc (GB22T12345, AU 18 RMR 18861 …): fără cheie, importul și căutarea nu
 * i-ar găsi și ar face dubluri. La pornire, după migrări, primesc cheia și câmpurile inelului.
 *
 * Nu e o migrare numerotată (alt branch adaugă migrări): e idempotentă, atinge doar rândurile cu ring_key NULL, nu
 * schimbă o cheie existentă și sare peste un rând a cărui cheie ar dubla alt porumbel de același fel din cont
 * (indexurile unice ux_pigeons_own_ring / ux_pigeons_ext_ring din src/db.js). A doua rulare nu mai schimbă nimic.
 * O eroare la un rând (de ex. o dublură scrisă de alt proces între verificare și scriere, când o publicare pe Railway
 * se suprapune cu cea veche) lasă doar acel rând cum era. `beforeUpdate` e doar pentru teste.
 */
export async function backfillRingKeys({ beforeUpdate = null } = {}) {
  const rows = await all(`SELECT id, account_id, kind, ring_raw, name FROM pigeons WHERE ring_key IS NULL AND ring_raw IS NOT NULL ORDER BY id`);
  let filled = 0;
  let skipped = 0;
  let errors = 0;
  for (const row of rows) {
    const r = parseRing(row.ring_raw);
    const key = ringKey(r);
    if (!key) continue;
    if (await one('SELECT 1 FROM pigeons WHERE account_id = ? AND kind = ? AND ring_key = ?', row.account_id, row.kind, key)) {
      skipped++;
      continue;
    }
    // search_text ca în pigeons.js: numele, textul scris și forma normalizată.
    const search = fold([row.name, row.ring_raw, formatRing(r)].filter(Boolean).join(' '));
    try {
      await beforeUpdate?.(row);
      const { changes } = await run(
        `UPDATE pigeons SET ring_key = ?, ring_country = ?, ring_year = ?, ring_club = ?, ring_number = ?, search_text = ?
          WHERE id = ? AND ring_key IS NULL`,
        key, r.country, r.year, r.club, r.number, search, row.id,
      );
      filled += changes;
    } catch (err) {
      // 23505 = indexul unic: alt porumbel a primit între timp aceeași cheie.
      if (err?.code === '23505') skipped++;
      else {
        errors++;
        console.error(`[porumbar] Cheia inelului pentru porumbelul ${row.id} nu s-a completat: ${err?.message ?? err}`); // i18n: ro
      }
    }
  }
  // În jurnal doar când s-a schimbat ceva sau a fost o eroare (rândurile lăsate rămân la fiecare pornire).
  if (filled || errors) console.log(`[porumbar] Inele recunoscute acum: ${filled} completate, ${skipped} lăsate (ar dubla alt porumbel din cont), ${errors} erori.`); // i18n: ro
  return { filled, skipped, errors };
}

/** La pornire: o eroare a completării (baza, alt proces) se scrie în jurnal, dar nu oprește serverul. */
export async function backfillAtStartup(fill = backfillRingKeys) {
  try {
    const out = await fill();
    // Regula anului s-a schimbat („27” = 2027, nu 1927): dacă baza are inele salvate cu anul 1927, se vede în jurnal.
    const p = await one('SELECT count(*)::int AS n FROM pigeons WHERE ring_year = 1927');
    const s = await one('SELECT count(*)::int AS n FROM ring_series WHERE year = 1927');
    if (p.n || s.n) console.warn(`[porumbar] Atenție: ${p.n} porumbei și ${s.n} serii de inele au anul 1927 (probabil 2027 scris „27”).`); // i18n: ro
    return out;
  } catch (err) {
    console.error(`[porumbar] Completarea cheilor inelelor a eșuat, serverul pornește oricum: ${err?.message ?? err}`); // i18n: ro
    return null;
  }
}
