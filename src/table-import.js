import { all, insert, lockAccount, nowIso, run, tx } from './db.js';
import { HttpError, badRequest } from './http.js';
import { tr } from './i18n.js';
import { matchColor } from './catalog.js';
import { ancestorIds } from './genealogy.js';
import { insertPigeons, loadNodes, ringOf, updatePigeon, validNewPigeon } from './pigeons.js';
import { fallbackKey, formatRing, parseRing, ringKey } from './rings.js';
import { cut, readBreed, readDate, readEyeColor, readLines, readSex, readStatus, ringWithCountry } from './table-values.js';

/*
 * „Adu porumbeii din Excel”: rândurile unui tabel (doar celulele coloanelor alese, citite în browser) devin porumbei
 * proprii ai contului (spec 2026-11-23-import-excel, regulile 3–8).
 *
 * Previzualizarea și salvarea rulează același cod, în aceeași tranzacție, cu contul blocat: previzualizarea aruncă la
 * final un semnal propriu (Preview), tranzacția se anulează și rezumatul pleacă așa cum ar fi ieșit la salvare.
 *
 * Două treceri: întâi se așază toate rândurile (porumbel nou, existent completat sau strămoș făcut propriu), apoi se
 * leagă părinții, deci ordinea rândurilor nu contează. Porumbeii contului și graful părinților se citesc o singură dată
 * și se țin la zi în memorie; porumbeii noi se scriu câte 500 într-o instrucțiune, legăturile toate odată la final.
 * Un rând greșit nu oprește importul: apare în rezumat („problems”). Nicio instrucțiune SQL nu are voie să greșească
 * în tranzacție (PostgreSQL ar anula tot): dublurile și inelele se verifică înainte, în memorie, iar erorile noastre
 * (HttpError, aruncate înainte de orice scriere) devin probleme ale rândului.
 *
 * Salvarea ține minte ce a făcut (excel_imports + excel_import_items), pentru anulare:
 *   created   – porumbel creat de import; `fields` = toate coloanele puse (CREATED_COLUMNS), cu părinții legați;
 *   filled    – porumbel existent; `fields` = doar coloanele completate (și legăturile), cu valoarea pusă;
 *   converted – strămoș „din alt porumbar” făcut propriu; ca `filled`, plus `kind` și `prev_kind`.
 */

export const MAX_ROWS = 3000;
const MAX_CELL = 2000;
const MAX_PROBLEMS = 100;
const MAX_RING = 80;
const CELLS = ['ring', 'name', 'sex', 'color', 'eyeColor', 'breed', 'lines', 'hatchedOn', 'breeder', 'status', 'father', 'mother', 'notes'];

/** Coloanele unui porumbel creat de import (copia din jurnal; anularea le compară cu rândul de atunci). */
const CREATED_COLUMNS = ['kind', 'ring_raw', 'ring_key', 'ring_country', 'ring_year', 'ring_club', 'ring_number', 'sex', 'name', 'breed',
  'lines', 'color', 'color_pa', 'color_text', 'eye_color', 'status', 'hatched_on', 'breeder_text', 'pedigree_text', 'father_id', 'mother_id'];

/** Câmpurile completate la un porumbel existent (doar dacă sunt goale): câmpul din fișă → coloana din tabel. */
const FILLABLE = [['sex', 'sex'], ['name', 'name'], ['color', 'color'], ['colorText', 'color_text'], ['eyeColor', 'eye_color'], ['status', 'status'],
  ['hatchedOn', 'hatched_on'], ['breederText', 'breeder_text'], ['pedigreeText', 'pedigree_text']];

/** Semnalul previzualizării: anulează tranzacția și duce rezumatul afară. */
class Preview {
  constructor(summary) {
    this.summary = summary;
  }
}

// Celula ca text: numerele (de la alți clienți) devin text, caracterul nul (refuzat de PostgreSQL) cade, lungimea se taie.
const cell = (v) => (typeof v === 'string' ? v : typeof v === 'number' && Number.isFinite(v) ? String(v) : '').replaceAll('\u0000', '').slice(0, MAX_CELL);
const hasSign = (s) => /[\p{L}\p{N}]/u.test(s);

/** Țara implicită doar dacă `rings.js` o cunoaște (altfel se ignoră). */
function knownCountry(code) {
  if (typeof code !== 'string' || !/^[A-Za-z]{1,8}$/.test(code)) return null;
  const c = code.toUpperCase();
  const probe = parseRing(`${c} 24 0117345`);
  return probe.ok || probe.needsClub ? c : null;
}

/** Corpul cererii, curățat; 400 pentru un tabel gol sau prea mare. */
function readBody(body) {
  const list = body && typeof body === 'object' ? body.rows : null;
  if (!Array.isArray(list) || list.length < 1 || list.length > MAX_ROWS) throw badRequest('eroare.import_randuri', { max: MAX_ROWS });
  const rows = list.map((raw, i) => {
    const r = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    const row = { line: Number.isSafeInteger(r.line) && r.line > 0 ? r.line : i + 1 };
    for (const c of CELLS) row[c] = cell(r[c]).trim();
    return row;
  });
  return { rows, country: knownCountry(body.defaultCountry) };
}

/**
 * Inelul dintr-o celulă, cu țara implicită pusă doar dacă altfel nu se citește (regula 1a).
 * state: 'empty' (fără inel), 'ok', 'fallback' (necitit, dar cu cheie de rezervă), 'hu' (maghiar fără asociație), 'bad'.
 * `keys`: cheia inelului și, când țara a fost pusă de import, și cheia de rezervă a textului scris fără ea: un porumbel
 * trecut de mână ca „24-0117345” (cheia „?|240117345”) e același cu „24-0117345” + RO, deci nu se dublează.
 */
function readRing(text, country) {
  if (!text) return { state: 'empty' };
  if (text.length > MAX_RING) return { state: 'bad', label: text.slice(0, MAX_RING) };
  const raw = ringWithCountry(text, country);
  const parsed = parseRing(raw);
  if (parsed.ok && parsed.unringed) return { state: 'empty' };
  if (raw.length > MAX_RING) return { state: 'bad', label: text };
  const written = raw !== text ? fallbackKey(parseRing(text)) : null;
  const keysOf = (key) => (written && written !== key ? [key, written] : [key]);
  if (parsed.ok) {
    const key = ringKey(parsed);
    return { state: 'ok', raw, parsed, key, keys: keysOf(key), label: formatRing(parsed) };
  }
  // Maghiar fără asociație, scris așa sau devenit maghiar prin țara implicită: numerele se repetă între asociații.
  if (parsed.needsClub || (country && parseRing(`${country} ${text}`).needsClub)) return { state: 'hu', label: text };
  const key = fallbackKey(parsed);
  return key ? { state: 'fallback', raw, parsed, key, keys: [key], label: text } : { state: 'bad', label: text };
}

const realDay = (d) => (d && d >= '1900-01-01' && d <= '2100-12-31' ? d : null);

/** Câmpurile fișei din celulele rândului (fără inel, rasă și părinți). */
function rowFields(row) {
  const color = row.color ? matchColor(row.color) : null;
  const lines = [];
  for (const l of readLines(row.lines)) {
    const s = l.slice(0, 40).trim();
    if (s && !lines.includes(s)) lines.push(s);
  }
  return {
    sex: readSex(row.sex),
    name: cut(row.name, 80),
    color: color?.code ?? null,
    colorPa: Boolean(color?.code && color.pa),
    // Culoarea recunoscută întreagă nu mai rămâne și ca text; altfel textul se păstrează (nu se pierde nimic).
    colorText: color?.code && !color.rest ? null : cut(row.color, 120),
    eyeColor: readEyeColor(row.eyeColor),
    status: readStatus(row.status),
    hatchedOn: realDay(readDate(row.hatchedOn)),
    breederText: cut(row.breeder, 200),
    pedigreeText: cut(row.notes, 2000),
    lines,
  };
}

/** Rândul unui porumbel, așa cum îl ține importul în memorie (coloanele din baza de date). */
const SELECT_COLUMNS = `id, kind, ring_raw, ring_key, ring_country, ring_year, ring_club, ring_number, sex, name, lines, color, color_pa,
  color_text, eye_color, status, hatched_on, breeder_text, pedigree_text, father_id, mother_id`;

/**
 * Importul tabelului. `save: false` = previzualizarea (nimic nu rămâne în baza de date). Întoarce rezumatul:
 * { created, existing, ancestors, problems: [{ line, ring, kind, message }] (cel mult 100), problemCount, importId? }.
 */
export async function importTable(accountId, body, { save }) {
  const { rows, country } = readBody(body);
  try {
    return await tx(async () => {
      await lockAccount(accountId); // importurile și legăturile aceluiași cont, una după alta
      const { summary, log } = await runImport(accountId, rows, country);
      if (!save) throw new Preview(summary);
      const importId = await insert('INSERT INTO excel_imports (account_id, created_at, summary) VALUES (?, ?, ?)', accountId, nowIso(), JSON.stringify(summary));
      await writeLog(importId, log);
      return { ...summary, importId };
    });
  } catch (err) {
    if (err instanceof Preview) return err.summary;
    throw err;
  }
}

async function runImport(accountId, rows, country) {
  const stats = { created: 0, existing: 0, ancestors: 0 };
  const problems = [];
  const problem = (line, ring, kind, message) => problems.push({ line, ring: ring ?? null, kind, message });

  // Porumbeii contului și graful părinților, o singură dată; de aici încolo se țin la zi în memorie.
  const known = await all(`SELECT ${SELECT_COLUMNS} FROM pigeons WHERE account_id = ? ORDER BY (kind = 'own') DESC, id`, accountId);
  const nodes = await loadNodes(accountId);
  const byId = new Map(known.map((p) => [p.id, p]));
  const byKey = new Map();
  for (const p of known) if (p.ring_key && !byKey.has(p.ring_key)) byKey.set(p.ring_key, p); // propriul înaintea strămoșului
  const fathers = new Set();
  const mothers = new Set();
  for (const n of nodes.values()) {
    if (n.fatherId) fathers.add(n.fatherId);
    if (n.motherId) mothers.add(n.motherId);
  }
  // Sexul de fapt: cel scris sau, fără el, cel care reiese din legături (tatăl cuiva e mascul).
  const sexOf = (p) => p.sex ?? (fathers.has(p.id) ? 'M' : mothers.has(p.id) ? 'F' : null);
  /** Porumbelul contului (sau din tabel) cu una dintre cheile inelului, cea recunoscută întâi. */
  const find = (ring) => ring.keys.map((k) => byKey.get(k)).find(Boolean);
  const labelOf = (p) => p.label ?? ringOf(p)?.display ?? tr('text.fara_inel');

  /** Ce a făcut importul fiecărui porumbel: id → { action, cols } (pentru jurnalul anulării). */
  const log = new Map();
  const touch = (id, col) => {
    const e = log.get(id);
    if (e?.action === 'created') return;
    if (e) e.cols.add(col);
    else log.set(id, { action: 'filled', cols: new Set([col]) });
  };
  /** Porumbeii noi (fișe validate), scriși toți deodată; apoi intră în memorie ca oricare altul. */
  const insertNew = async (pending) => {
    const ids = await insertPigeons(accountId, pending.map((x) => x.pigeon));
    pending.forEach(({ rec }, i) => {
      rec.id = ids[i];
      byId.set(rec.id, rec);
      byKey.set(rec.ring_key, rec);
      nodes.set(rec.id, { id: rec.id, fatherId: null, motherId: null });
      log.set(rec.id, { action: 'created' });
    });
  };
  const newRec = (pigeon, key, label) => ({ id: null, kind: pigeon.kind, ring_key: key, ring_raw: pigeon.ring.raw, sex: pigeon.sex, father_id: null, mother_id: null, label });
  const refused = (err) => tr('import_excel.rand_refuzat', { motiv: tr(err.message, err.vars) });

  // Prima trecere: fiecare rând devine un porumbel propriu (nou, existent completat sau strămoș făcut propriu).
  const seen = new Map();
  const placed = [];
  const pendingOwn = [];
  for (const row of rows) {
    if (CELLS.every((c) => !row[c])) continue; // rândul gol nu e un porumbel
    const ring = readRing(row.ring, country);
    if (ring.state === 'empty') {
      problem(row.line, null, 'fara_inel', tr('import_excel.fara_inel'));
      continue;
    }
    if (ring.state === 'bad' || ring.state === 'hu') {
      problem(row.line, ring.label, 'inel_necitit', tr(ring.state === 'hu' ? 'import_excel.inel_hu_asociatie' : 'import_excel.inel_necitit', { inel: ring.label }));
      continue;
    }
    const first = ring.keys.find((k) => seen.has(k));
    if (first) {
      problem(row.line, ring.label, 'dublura', tr('import_excel.dublura', { inel: ring.label, rand: seen.get(first) }));
      continue;
    }
    for (const k of ring.keys) seen.set(k, row.line);
    const f = rowFields(row);
    let rec = find(ring);
    try {
      if (!rec) {
        // Nou: fișa se validează acum (ca la „Porumbel nou”) și se scrie după trecere, împreună cu celelalte.
        const pigeon = validNewPigeon({ kind: 'own', ring: ring.raw, breed: readBreed(row.breed), ...f });
        rec = newRec(pigeon, ring.key, ring.label);
        pendingOwn.push({ rec, pigeon });
        stats.created++;
      } else {
        // Există deja (regula 6): se completează doar câmpurile goale; ce era scris nu se schimbă.
        const had = sexOf(rec);
        if (f.sex && had && f.sex !== had) {
          problem(row.line, ring.label, 'conflict', tr(had === 'M' ? 'import_excel.conflict_sex_mascul' : 'import_excel.conflict_sex_femela', { inel: ring.label }));
        }
        const patch = {};
        const cols = [];
        for (const [field, col] of FILLABLE) {
          if (rec[col] == null && f[field] != null && (field !== 'sex' || !had || had === f.sex)) (patch[field] = f[field]), cols.push(col);
        }
        if (patch.color && f.colorPa) (patch.colorPa = true), cols.push('color_pa');
        if (!rec.lines?.length && f.lines.length) (patch.lines = f.lines), cols.push('lines');
        const converted = rec.kind === 'external';
        if (converted) (patch.kind = 'own'), cols.push('kind');
        if (cols.length) {
          await updatePigeon(accountId, rec.id, patch);
          for (const [field, col] of [...FILLABLE, ['colorPa', 'color_pa'], ['lines', 'lines'], ['kind', 'kind']]) if (field in patch) rec[col] = patch[field];
          if (converted) log.set(rec.id, { action: 'converted', cols: new Set(cols) });
          else for (const col of cols) touch(rec.id, col);
        }
        stats.existing++;
      }
    } catch (err) {
      if (!(err instanceof HttpError)) throw err;
      problem(row.line, ring.label, 'conflict', refused(err));
      continue;
    }
    // Inelul scris, dar necitit: porumbelul s-a adăugat așa cum e scris (cheia de rezervă), iar rândul apare în rezumat.
    if (ring.state === 'fallback') problem(row.line, ring.label, 'inel_necitit', tr('import_excel.inel_necitit_pus', { inel: ring.label }));
    placed.push({ row, rec, label: ring.label });
  }
  await insertNew(pendingOwn);

  const SIDES = [
    ['father', 'M', 'father_id', 'fatherId', 'tata'],
    ['mother', 'F', 'mother_id', 'motherId', 'mama'],
  ];
  /** Inelul din coloana tată / mamă; null când celula n-are inel („-”, „?”, gol). */
  const parentRing = (row, side) => {
    const text = row[side];
    if (!text || !hasSign(text)) return null;
    const pr = readRing(text, country);
    return pr.state === 'empty' ? null : pr;
  };

  // Strămoșii noi: părinții care nu sunt nici în tabel, nici în cont devin porumbei „din alt porumbar”, cu sexul locului.
  // Se fac doar pentru un copil care nu are deja alt părinte pe acel loc, deci prima legătură spre fiecare reușește
  // sigur (n-au părinți, deci nici ciclu; sexul e cel cerut) și niciun strămoș nu rămâne nelegat.
  const pendingAncestors = new Map();
  for (const { row, rec } of placed) {
    for (const [side, parentSex, col] of SIDES) {
      const pr = parentRing(row, side);
      if (pr?.state !== 'ok' || rec[col] || find(pr) || pendingAncestors.has(pr.key)) continue;
      try {
        const pigeon = validNewPigeon({ kind: 'external', ring: pr.raw, sex: parentSex });
        pendingAncestors.set(pr.key, { rec: newRec(pigeon, pr.key, pr.label), pigeon });
      } catch (err) {
        if (!(err instanceof HttpError)) throw err;
      }
    }
  }
  stats.ancestors = pendingAncestors.size;
  await insertNew([...pendingAncestors.values()]);

  // A doua trecere: legăturile (regula 7), în memorie; la final se scriu toate odată.
  const changes = new Map(); // id → { f, m, s }
  const change = (id) => changes.get(id) ?? changes.set(id, { f: null, m: null, s: null }).get(id);
  for (const { row, rec, label } of placed) {
    for (const [side, parentSex, col, nodeKey, word] of SIDES) {
      const pr = parentRing(row, side);
      if (!pr) continue;
      if (pr.state !== 'ok') {
        problem(row.line, label, 'parinte_necitit', tr(`import_excel.parinte_necitit_${word}`, { parinte: pr.label }));
        continue;
      }
      const current = rec[col] ? byId.get(rec[col]) : null;
      if (current) {
        // Aceeași legătură: nimic de făcut; alta decât în tabel: nu se schimbă.
        if (!pr.keys.includes(current.ring_key)) {
          problem(row.line, label, 'conflict', tr(word === 'tata' ? 'import_excel.conflict_alt_tata' : 'import_excel.conflict_alta_mama', { inel: label, are: labelOf(current), tabel: pr.label }));
        }
        continue;
      }
      const parent = find(pr);
      if (!parent) {
        problem(row.line, label, 'parinte_necitit', tr(`import_excel.parinte_necitit_${word}`, { parinte: pr.label }));
        continue;
      }
      if (parent.id === rec.id || ancestorIds(parent.id, nodes).has(rec.id)) {
        problem(row.line, label, 'conflict', tr('import_excel.conflict_ciclu', { parinte: pr.label, copil: label }));
        continue;
      }
      const ps = sexOf(parent);
      if (ps && ps !== parentSex) {
        problem(row.line, label, 'conflict', tr(`import.conflict_${word}_${ps === 'M' ? 'mascul' : 'femela'}`, { parinte: pr.label, copil: label }));
        continue;
      }
      if (!parent.sex) {
        parent.sex = parentSex;
        change(parent.id).s = parentSex;
        touch(parent.id, 'sex');
      }
      rec[col] = parent.id;
      nodes.get(rec.id)[nodeKey] = parent.id;
      (parentSex === 'M' ? fathers : mothers).add(parent.id);
      change(rec.id)[parentSex === 'M' ? 'f' : 'm'] = parent.id;
      touch(rec.id, col);
    }
  }

  // Legăturile și sexele puse, dintr-o singură instrucțiune (nu câte una pe rând).
  if (changes.size) {
    const ids = [...changes.keys()];
    const v = ids.map((id) => changes.get(id));
    await run(
      `UPDATE pigeons p SET father_id = COALESCE(v.f, p.father_id), mother_id = COALESCE(v.m, p.mother_id), sex = COALESCE(p.sex, v.s), updated_at = ?
         FROM unnest(?::bigint[], ?::bigint[], ?::bigint[], ?::text[]) AS v(id, f, m, s)
        WHERE p.id = v.id AND p.account_id = ?`,
      nowIso(), ids, v.map((x) => x.f), v.map((x) => x.m), v.map((x) => x.s), accountId,
    );
  }

  problems.sort((a, b) => a.line - b.line);
  const summary = { ...stats, problems: problems.slice(0, MAX_PROBLEMS), problemCount: problems.length };
  return { summary, log };
}

/** Jurnalul importului pentru anulare: valorile scrise, citite înapoi din baza de date (exact cum stau acolo). */
async function writeLog(importId, log) {
  if (!log.size) return;
  const ids = [...log.keys()];
  const now = new Map((await all(`SELECT id, ${CREATED_COLUMNS.join(', ')} FROM pigeons WHERE id = ANY(?::bigint[])`, ids)).map((r) => [r.id, r]));
  const pick = (row, cols) => Object.fromEntries(cols.map((c) => [c, row[c]]));
  const items = ids.map((id) => {
    const e = log.get(id);
    const row = now.get(id);
    const fields = e.action === 'created' ? pick(row, CREATED_COLUMNS) : { ...(e.action === 'converted' ? { prev_kind: 'external' } : {}), ...pick(row, [...e.cols]) };
    return { pigeon_id: id, action: e.action, fields };
  });
  await run(
    `INSERT INTO excel_import_items (import_id, pigeon_id, action, fields)
     SELECT ?, x.pigeon_id, x.action, x.fields FROM jsonb_to_recordset(?::jsonb) AS x(pigeon_id bigint, action text, fields jsonb)`,
    importId, JSON.stringify(items),
  );
}
