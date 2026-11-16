import { one, run, tx } from './db.js';
import { ancestorIds } from './genealogy.js';
import { badRequest } from './http.js';
import { matchColor } from './catalog.js';
import { createPigeon, getPigeonRow, loadNodes, updatePigeon } from './pigeons.js';
import { formatRing, parseRing, ringKey } from './rings.js';

/*
 * Importul unui pedigree întreg dintr-un singur pas („Pedigree pe hârtie”, apoi citirea din poză / PDF): rădăcina
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
  if (typeof raw !== 'object' || Array.isArray(raw)) throw badRequest('Pedigree-ul nu are forma așteptată.');
  if (depth >= MAX_GENERATIONS) throw badRequest(`Pedigree-ul poate avea cel mult ${MAX_GENERATIONS} generații.`);
  const ring = str(raw.ring, 80);
  const node = {
    ring,
    parsed: ring ? parseRing(ring) : null,
    sex: raw.sex === 'M' || raw.sex === 'F' ? raw.sex : null,
    name: str(raw.name, 80),
    color: str(raw.color, 120),
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
const label = (node) => (node.parsed?.ok && !node.parsed.unringed ? formatRing(node.parsed) : node.ring || 'fără inel');

/** Câmpurile fișei din căsuță (pentru un porumbel nou). */
function fields(node, kind, sex) {
  const color = node.color ? matchColor(node.color) : null;
  return {
    kind,
    ring: node.ring,
    sex: node.sex ?? sex,
    name: node.name,
    color: color?.code ?? null,
    colorPa: color?.pa ?? false,
    colorText: node.color,
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
  if (rootKind !== 'own' && rootKind !== 'external') throw badRequest('Tipul porumbelului nu e valid.');
  const root = readNode(rawRoot, 0);
  if (!root) throw badRequest('Scrie cel puțin inelul porumbelului.');
  const stats = { created: 0, reused: 0, conflicts: [] };

  return tx(async () => {
    const byKey = async (key) =>
      key ? one(`SELECT * FROM pigeons WHERE account_id = ? AND ring_key = ? ORDER BY (kind = 'own') DESC, id LIMIT 1`, accountId, key) : null;

    /** Așază căsuța: găsește sau creează porumbelul, apoi părinții lui. `existingId` = părintele deja legat în program. */
    const place = async (node, kind, sex, existingId = null) => {
      let row = existingId ? await getPigeonRow(accountId, existingId) : await byKey(keyOf(node));
      if (!row || (kind === 'own' && row.kind === 'external')) {
        // Nou, sau un strămoș care devine acum porumbelul meu (createPigeon îl transformă, cu tot cu legături).
        const p = await createPigeon(accountId, fields(node, kind, sex));
        if (row) stats.reused++;
        else stats.created++;
        row = await getPigeonRow(accountId, p.id);
      } else {
        stats.reused++;
        const patch = missing(row, node, sex);
        if (Object.keys(patch).length) {
          await updatePigeon(accountId, row.id, patch);
          row = await getPigeonRow(accountId, row.id);
        }
      }

      for (const [side, parentSex, column, word] of [
        ['father', 'M', 'father_id', 'tatăl'],
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
            message: `La ${label(node)} programul are deja ${word === 'tatăl' ? 'tată' : 'mamă'} ${current.ring_raw ?? 'fără inel'}, iar pe hârtie scrie ${label(paper)}. Am păstrat ce era.`,
          });
          continue;
        }
        const parent = await getPigeonRow(accountId, parentId);
        if (parent.id === row.id || ancestorIds(parent.id, await loadNodes(accountId)).has(row.id)) {
          throw badRequest(`Inelul ${label(paper)} apare și ca strămoș al lui însuși. Verifică inelele.`);
        }
        if (parent.sex && parent.sex !== parentSex) {
          stats.conflicts.push({
            ring: label(paper),
            message: `${label(paper)} e trecut ca ${word} lui ${label(node)}, dar în program e ${parent.sex === 'M' ? 'mascul' : 'femelă'}. Nu l-am legat.`,
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
    return { pigeonId, ...stats };
  });
}
