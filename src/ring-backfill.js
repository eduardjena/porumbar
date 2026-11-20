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
 */
export async function backfillRingKeys() {
  const rows = await all(`SELECT id, account_id, kind, ring_raw, name FROM pigeons WHERE ring_key IS NULL AND ring_raw IS NOT NULL ORDER BY id`);
  let filled = 0;
  let skipped = 0;
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
    const { changes } = await run(
      `UPDATE pigeons SET ring_key = ?, ring_country = ?, ring_year = ?, ring_club = ?, ring_number = ?, search_text = ?
        WHERE id = ? AND ring_key IS NULL`,
      key, r.country, r.year, r.club, r.number, search, row.id,
    );
    filled += changes;
  }
  if (filled || skipped) console.log(`[porumbar] Inele recunoscute acum: ${filled} completate, ${skipped} lăsate (ar dubla alt porumbel din cont).`); // i18n: ro
  return { filled, skipped };
}
