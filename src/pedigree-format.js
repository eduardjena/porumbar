import { all, one } from './db.js';
import { COLORS } from './catalog.js';
import { formatRing } from './rings.js';
import { yearOf } from './pigeons.js';
import { parseRing } from './rings.js';

/*
 * Formatul deschis „porumbar-pedigree” v1 (spec §2): ce se vede pe linkul public / QR și ce se copiază la preluare.
 * Doar câmpurile publice ale porumbelului; niciodată evaluarea, jurnalul, starea sau id-urile din program.
 * Proprietarul: numele, plus telefonul / adresa / emailul doar dacă le-a bifat la „Ce apare pe pedigree”.
 */

export const FORMAT = 'porumbar-pedigree';
export const VERSION = 1;
const GENERATIONS = 5; // porumbelul + 4 generații (31 de căsuțe), ca pe pedigree-ul tipărit

const colorLabel = (code) => COLORS.find((c) => c.code === code)?.label ?? null;

function ringDisplay(row) {
  if (!row.ring_raw) return null;
  const r = parseRing(row.ring_raw);
  return r.ok && !r.unringed ? formatRing(r) : row.ring_raw;
}

/** Un nod public; părinții până la 5 generații (un ciclu vechi din date se oprește la limită). */
function node(row, byId, depth) {
  if (!row) return null;
  const parent = (id) => (depth + 1 < GENERATIONS && id ? node(byId.get(id), byId, depth + 1) : null);
  return {
    ring: ringDisplay(row),
    ringRaw: row.ring_raw ?? null,
    sex: row.sex ?? null,
    name: row.name ?? null,
    breed: row.breed ?? null,
    lines: row.lines ?? [],
    color: row.color ?? null,
    colorLabel: colorLabel(row.color),
    colorPa: !!row.color_pa,
    colorText: row.color_text ?? null,
    eyeColor: row.eye_color ?? null,
    year: yearOf(row),
    hatchedOn: row.hatched_on ?? null,
    breeder: row.breeder_text ?? null,
    pedigreeText: row.pedigree_text ?? null,
    father: parent(row.father_id),
    mother: parent(row.mother_id),
  };
}

/** Pedigree-ul porumbelului (al contului dat) în formatul deschis. */
export async function pedigreeV1(accountId, rootId) {
  const account = await one('SELECT name, phone, address, email, show_phone, show_address, show_email FROM accounts WHERE id = ?', accountId);
  const rows = await all('SELECT * FROM pigeons WHERE account_id = ?', accountId);
  const byId = new Map(rows.map((r) => [r.id, r]));
  const owner = { name: account.name };
  if (account.show_phone && account.phone) owner.phone = account.phone;
  if (account.show_address && account.address) owner.address = account.address;
  if (account.show_email) owner.email = account.email;
  return { format: FORMAT, version: VERSION, generatedAt: new Date().toISOString(), owner, root: node(byId.get(rootId), byId, 0) };
}

/** Nodul public → nodul primit de importul de pedigree (src/pedigree-import.js). */
export function toImportNode(n) {
  if (!n) return null;
  return {
    ring: n.ringRaw ?? n.ring,
    sex: n.sex,
    name: n.name,
    color: n.colorText ?? (n.colorLabel ? `${n.colorLabel}${n.colorPa ? ' p.a.' : ''}` : null),
    text: n.pedigreeText,
    breeder: n.breeder,
    father: toImportNode(n.father),
    mother: toImportNode(n.mother),
  };
}
