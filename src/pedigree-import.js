import { lockAccount, one, run, tx } from './db.js';
import { tr } from './i18n.js';
import { ancestorIds } from './genealogy.js';
import { badRequest } from './http.js';
import { COLORS, matchColor } from './catalog.js';
import { createPigeon, getPigeonRow, loadNodes, updatePigeon } from './pigeons.js';
import { formatRing, parseRing, ringKey } from './rings.js';

/*
 * Importul unui pedigree întreg dintr-un singur pas („Importă pedigree”, apoi citirea din poză / PDF): rădăcina
 * (porumbelul propriu sau unul „din alt porumbar”) și strămoșii, cel mult 5 generații (31 de căsuțe).
 *
 * Reguli (spec §8): același inel e un singur porumbel în cont, deci un strămoș deja trecut se refolosește; ce era
 * scris rămâne (se completează doar câmpurile goale); o legătură existentă care nu se potrivește cu hârtia nu se
 * schimbă în tăcere, ci apare în `conflicts`. Totul într-o tranzacție: o greșeală nu lasă jumătăți de pedigree.
 *
 * Nod primit: { ring, sex?, name?, color?, text?, breeder?, father?, mother? } (color / text / breeder = text liber).
 */

export const MAX_GENERATIONS = 5;
const MAX_TEXT = 2000;

const str = (v, max) => {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s.slice(0, max) : null;
};

/** Nodul curățat; aruncă 400 pentru forme greșite sau prea multe generații. */
function readNode(raw, depth) {
  if (raw == null) return null;
  if (typeof raw !== 'object' || Array.isArray(raw)) throw badRequest('eroare.pedigree_forma');
  if (depth >= MAX_GENERATIONS) throw badRequest('eroare.pedigree_generatii', { numar: MAX_GENERATIONS });
  const ring = str(raw.ring, 80);
  const node = {
    ring,
    parsed: ring ? parseRing(ring) : null,
    sex: raw.sex === 'M' || raw.sex === 'F' ? raw.sex : null,
    name: str(raw.name, 80),
    color: str(raw.color, 120),
    colorCode: typeof raw.colorCode === 'string' && COLORS.some((c) => c.code === raw.colorCode) ? raw.colorCode : null,
    colorPa: raw.colorPa === true,
    text: str(raw.text, MAX_TEXT),
    breeder: str(raw.breeder, 200),
    father: readNode(raw.father, depth + 1),
    mother: readNode(raw.mother, depth + 1),
  };
  // O căsuță goală (fără inel și fără nimic scris) nu e un porumbel.
  const empty = !ring && !node.name && !node.text && !node.color && !node.breeder && !node.father && !node.mother;
  return empty ? null : node;
}

const keyOf = (node) => (node.parsed?.ok && !node.parsed.unringed ? ringKey(node.parsed) : null);
const label = (node) => (node.parsed?.ok && !node.parsed.unringed ? formatRing(node.parsed) : node.ring || tr('text.fara_inel'));

/** Câmpurile fișei din căsuță (pentru un porumbel nou). */
function fields(node, kind, sex) {
  // Culoarea din listă venită ca cod (preluare / vânzare): se păstrează codul, fără textul în română.
  const color = node.colorCode ? { code: node.colorCode, pa: node.colorPa } : node.color ? matchColor(node.color) : null;
  return {
    kind,
    ring: node.ring,
    sex: node.sex ?? sex,
    name: node.name,
    color: color?.code ?? null,
    colorPa: color?.pa ?? false,
    colorText: node.colorCode ? null : node.color,
    breederText: node.breeder,
    pedigreeText: node.text,
  };
}

/** Doar câmpurile goale ale unui porumbel existent se completează din hârtie. */
function missing(row, node, sex) {
  const f = fields(node, row.kind, sex);
  const patch = {};
  if (!row.sex && f.sex) patch.sex = f.sex;
  if (!row.name && f.name) patch.name = f.name;
  if (!row.color && f.color) (patch.color = f.color), (patch.colorPa = f.colorPa);
  if (!row.color_text && f.colorText) patch.colorText = f.colorText;
  if (!row.breeder_text && f.breederText) patch.breederText = f.breederText;
  if (!row.pedigree_text && f.pedigreeText) patch.pedigreeText = f.pedigreeText;
  return patch;
}

/**
 * Pune pedigree-ul în cont. Întoarce { pigeonId, created, reused, conflicts: [{ ring, message }] }.
 * rootKind: 'own' (porumbelul meu) sau 'external' (de ex. un porumbel împrumutat pentru pui).
 */
export async function importPedigree(accountId, rawRoot, rootKind = 'own') {
  if (rootKind !== 'own' && rootKind !== 'external') throw badRequest('eroare.tip_porumbel');
  const root = readNode(rawRoot, 0);
  if (!root) throw badRequest('eroare.scrie_inelul');
  const stats = { created: 0, reused: 0, conflicts: [] };

  return tx(async () => {
    await lockAccount(accountId); // importurile aceluiași cont, unul după altul (fără dubluri și blocaje reciproce)
    stats.created = 0;
    stats.reused = 0;
    stats.conflicts = [];
    let rootWas = null;
    const byKey = async (key) =>
      key ? one(`SELECT * FROM pigeons WHERE account_id = ? AND ring_key = ? ORDER BY (kind = 'own') DESC, id LIMIT 1`, accountId, key) : null;

    /** Așază căsuța: găsește sau creează porumbelul, apoi părinții lui. `existingId` = părintele deja legat în program. */
    const place = async (node, kind, sex, existingId = null) => {
      let row = existingId ? await getPigeonRow(accountId, existingId) : await byKey(keyOf(node));
      const isRoot = !existingId && node === root;
      if (!row) {
        const p = await createPigeon(accountId, fields(node, kind, sex));
        stats.created++;
        row = await getPigeonRow(accountId, p.id);
        if (isRoot) rootWas = 'created';
      } else if (kind === 'own' && row.kind === 'external') {
        // Un strămoș „din alt porumbar” devine porumbelul meu: același rând, cu legăturile lui; ce era scris rămâne,
        // hârtia completează doar câmpurile goale.
        await updatePigeon(accountId, row.id, { kind: 'own', ...missing(row, node, sex) });
        stats.reused++;
        row = await getPigeonRow(accountId, row.id);
        if (isRoot) rootWas = 'converted';
      } else {
        if (isRoot) rootWas = 'existing';
        if (isRoot && node.sex && row.sex && node.sex !== row.sex) {
          stats.conflicts.push({ ring: label(node), message: tr(row.sex === 'M' ? 'import.conflict_sex_mascul' : 'import.conflict_sex_femela', { inel: label(node) }) });
        }
        stats.reused++;
        const patch = missing(row, node, sex);
        if (Object.keys(patch).length) {
          await updatePigeon(accountId, row.id, patch);
          row = await getPigeonRow(accountId, row.id);
        }
      }

      for (const [side, parentSex, column, word] of [
        ['father', 'M', 'father_id', 'tata'],
        ['mother', 'F', 'mother_id', 'mama'],
      ]) {
        const paper = node[side];
        if (!paper) continue;
        const current = row[column] ? await getPigeonRow(accountId, row[column]) : null;
        const paperKey = keyOf(paper);
        if (current && (!paperKey || paperKey === current.ring_key)) {
          await place(paper, 'external', parentSex, current.id); // același părinte: doar se completează
          continue;
        }
        const parentId = await place(paper, 'external', parentSex);
        if (current) {
          stats.conflicts.push({
            ring: label(node),
            message: tr(word === 'tata' ? 'import.conflict_alt_tata' : 'import.conflict_alta_mama', { inel: label(node), are: current.ring_raw ?? tr('text.fara_inel'), hartie: label(paper) }),
          });
          continue;
        }
        const parent = await getPigeonRow(accountId, parentId);
        if (parent.id === row.id || ancestorIds(parent.id, await loadNodes(accountId)).has(row.id)) {
          throw badRequest('eroare.inel_propriu_stramos', { inel: label(paper) });
        }
        if (parent.sex && parent.sex !== parentSex) {
          stats.conflicts.push({
            ring: label(paper),
            message: tr(`import.conflict_${word}_${parent.sex === 'M' ? 'mascul' : 'femela'}`, { parinte: label(paper), copil: label(node) }),
          });
          continue;
        }
        if (!parent.sex) await run('UPDATE pigeons SET sex = ? WHERE id = ?', parentSex, parent.id);
        await run(`UPDATE pigeons SET ${column} = ?, updated_at = now() WHERE id = ?`, parent.id, row.id);
        row = await getPigeonRow(accountId, row.id);
      }
      return row.id;
    };

    const pigeonId = await place(root, rootKind, root.sex);
    return { pigeonId, rootWas, ...stats };
  });
}
