import { all, insert, lockAccount, nowIso, one, run, tx } from './db.js';
import { HttpError, badRequest, notFound } from './http.js';
import { tr } from './i18n.js';
import { matchColor } from './catalog.js';
import { ancestorIds } from './genealogy.js';
import { insertPigeons, loadNodes, ringOf, updatePigeon, validNewPigeon } from './pigeons.js';
import { fallbackKey, formatRing, japaneseRingText, parseRing, ringKey } from './rings.js';
import { cut, readBreed, readDate, readEyeColor, readLines, readSex, readStatus, ringWithCountry, slashOrder } from './table-values.js';

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
 * Doar ultimul import al contului se poate anula, 7 zile (regula 10, undoLastImport); evidența mai veche se șterge
 * (pruneImports, la fiecare 6 ore).
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
 * La un cont japonez (`lang` = 'ja'), inelul cu forma japoneză (25-AB-01234) primește „JPN ” înaintea țării coloanei;
 * cel doar din cifre urmează țara coloanei, ca la celelalte conturi.
 */
function readRing(text, country, lang) {
  if (!text) return { state: 'empty' };
  // Fără nicio cifră nu e un inel: titlul tabelului („Inel”), un rând de secțiune („MASCULI”), un cuvânt.
  if (!/\d/.test(text)) return { state: 'bad', label: text.slice(0, MAX_RING) };
  if (text.length > MAX_RING) return { state: 'bad', label: text.slice(0, MAX_RING) };
  const raw = ringWithCountry(lang === 'ja' ? japaneseRingText(text) : text, country);
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

/** Câmpurile fișei din celulele rândului (fără inel, rasă și părinți); `dateOrder` = ordinea datelor cu „/” (slashOrder), `lang` = limba contului (culorile: la `ja` fără litere singure). */
function rowFields(row, dateOrder, lang) {
  const color = row.color ? matchColor(row.color, { lang }) : null;
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
    hatchedOn: realDay(readDate(row.hatchedOn, dateOrder, { lang })),
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
 * Un import care n-a creat, completat și n-a făcut propriu nimic nu se ține minte (fără `importId`): altfel ar lua
 * locul ultimului import adevărat și, cu el, anularea lui. În evidență rămân doar cifrele, nu și lista problemelor
 * (inelele din tabel; regula 11). `lang` = limba contului (inelele japoneze fără „JPN”, vezi readRing).
 */
export async function importTable(accountId, body, { save, lang = null }) {
  const { rows, country } = readBody(body);
  try {
    return await tx(async () => {
      await lockAccount(accountId); // importurile și legăturile aceluiași cont, una după alta
      const { summary, log } = await runImport(accountId, rows, country, lang);
      if (!save) throw new Preview(summary);
      if (!log.size) return summary;
      const counts = { created: summary.created, existing: summary.existing, ancestors: summary.ancestors, problemCount: summary.problemCount };
      const importId = await insert('INSERT INTO excel_imports (account_id, created_at, summary) VALUES (?, ?, ?)', accountId, nowIso(), JSON.stringify(counts));
      await writeLog(importId, log);
      return { ...summary, importId };
    });
  } catch (err) {
    if (err instanceof Preview) return err.summary;
    throw err;
  }
}

async function runImport(accountId, rows, country, lang) {
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
  const dateOrder = slashOrder(rows.map((r) => r.hatchedOn)); // ziua sau luna întâi, pe toată coloana
  const seen = new Map();
  const placed = [];
  const pendingOwn = [];
  for (const row of rows) {
    if (CELLS.every((c) => !row[c])) continue; // rândul gol nu e un porumbel
    const ring = readRing(row.ring, country, lang);
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
    const f = rowFields(row, dateOrder, lang);
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
    const pr = readRing(text, country, lang);
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

/* ---------- Anularea ultimului import (regula 10) ---------- */

/** Cât se poate anula un import; tot atât se ține și evidența lui (regula 11). */
const UNDO_MS = 7 * 24 * 3600 * 1000;

/** Coloanele pe care importul le completează la un porumbel existent → câmpul fișei și valoarea „gol” (NOT NULL: false, {}). */
const CLEAR = {
  sex: ['sex', null], name: ['name', null], color: ['color', null], color_pa: ['colorPa', false], color_text: ['colorText', null],
  eye_color: ['eyeColor', null], status: ['status', null], hatched_on: ['hatchedOn', null], breeder_text: ['breederText', null],
  pedigree_text: ['pedigreeText', null], lines: ['lines', []],
};

/** Aceeași valoare, așa cum o dau `pg` (rândul) și jsonb (evidența): text, număr, boolean, dată „YYYY-MM-DD”, listă. */
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** Ultimul import din Excel al contului, dacă se mai poate anula (neanulat și mai nou de 7 zile); altfel null. */
export async function lastImport(accountId) {
  const row = await one('SELECT id, created_at, undone_at, summary FROM excel_imports WHERE account_id = ? ORDER BY created_at DESC, id DESC LIMIT 1', accountId);
  if (!row || row.undone_at) return null;
  const until = Date.parse(row.created_at) + UNDO_MS;
  if (until <= Date.now()) return null;
  return { id: row.id, createdAt: row.created_at, created: row.summary?.created ?? 0, undoUntil: new Date(until).toISOString() };
}

/**
 * Porumbeii din listă la care trimite un rând din altă tabelă (jurnal, poze, rezultate, perechi, tratamente, transferuri…).
 * Tabelele se află din catalog (toate cheile străine spre pigeons(id)), deci și cele de mâine intră singure. Lipsesc:
 * pigeons (legăturile părinților se judecă separat) și evidența importului însăși.
 */
async function referencedIds(ids) {
  if (!ids.length) return new Set();
  const refs = await all(
    `SELECT c.conrelid::regclass::text AS tbl, quote_ident(a.attname) AS col
       FROM pg_constraint c JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
      WHERE c.contype = 'f' AND c.confrelid = 'pigeons'::regclass
        AND c.conrelid NOT IN ('pigeons'::regclass, 'excel_import_items'::regclass)
      ORDER BY 1, 2`,
  );
  if (!refs.length) return new Set();
  const sql = refs.map((r) => `SELECT ${r.col} AS id FROM ${r.tbl} WHERE ${r.col} = ANY(?::bigint[])`).join(' UNION ');
  return new Set((await all(sql, ...refs.map(() => ids))).map((r) => r.id));
}

/**
 * „Anulează importul”: doar ultimul import din Excel al contului, 7 zile, într-o tranzacție, cu contul blocat.
 * Totul se judecă după conținut (valorile din evidență față de cele de acum), nu după `updated_at`:
 *   - porumbelul creat se șterge doar dacă e neschimbat (coloanele din evidență; fără link public, cuib, notă de
 *     proveniență sau evaluare puse după), nu e în nicio altă tabelă și niciun porumbel nu-l are ca părinte în afara
 *     legăturilor făcute de același import care pleacă și ele; altfel rămâne (`kept`);
 *   - câmpurile și legăturile completate se golesc doar unde au încă valoarea pusă (`cleared` = porumbei atinși);
 *   - strămoșul făcut propriu redevine „din alt porumbar” dacă e încă propriu, neschimbat și nefolosit (`reverted`);
 *     cel schimbat sau folosit rămâne propriu (`kept`), dar și la el se golesc câmpurile și legăturile completate care
 *     au încă valoarea pusă (`cleared`, dacă s-a golit ceva): ce a scris omul rămâne, ce a pus importul pleacă.
 * Întoarce { deleted, kept, cleared, reverted }; 404 când nu e nimic de anulat.
 */
export async function undoLastImport(accountId) {
  return tx(async () => {
    await lockAccount(accountId);
    const imp = await lastImport(accountId);
    if (!imp) throw notFound('eroare.import_fara_anulare');
    const out = { deleted: 0, kept: 0, cleared: 0, reverted: 0 };

    const items = await all(
      `SELECT i.pigeon_id AS id, i.action, i.fields FROM excel_import_items i JOIN pigeons p ON p.id = i.pigeon_id AND p.account_id = ?
        WHERE i.import_id = ? ORDER BY i.pigeon_id`,
      accountId, imp.id,
    );
    const rows = new Map((await all(
      `SELECT id, ${CREATED_COLUMNS.join(', ')}, public_token, clutch_id, source_note, evaluation FROM pigeons WHERE id = ANY(?::bigint[])`,
      items.map((i) => i.id),
    )).map((r) => [r.id, r]));
    const byId = new Map(items.map((i) => [i.id, i]));
    const used = await referencedIds(items.filter((i) => i.action !== 'filled').map((i) => i.id));
    const unchanged = (it) => Object.entries(it.fields).every(([col, v]) => col === 'prev_kind' || same(rows.get(it.id)[col], v));
    const hasChildren = async (id) => Boolean(await one('SELECT 1 FROM pigeons WHERE father_id = ? OR mother_id = ? LIMIT 1', id, id));
    /** Golirea coloanelor completate care au încă valoarea pusă; sexul rămâne cât timp porumbelul e părintele cuiva. */
    const clearPatch = async (it) => {
      const row = rows.get(it.id);
      const patch = {};
      for (const [col, v] of Object.entries(it.fields)) if (CLEAR[col] && same(row[col], v)) patch[CLEAR[col][0]] = CLEAR[col][1];
      if ('sex' in patch && (await hasChildren(it.id))) delete patch.sex;
      return patch;
    };

    // 1. Strămoșii făcuți proprii: înapoi „din alt porumbar”, cu câmpurile completate golite (înaintea legăturilor, ca
    //    un refuz aici să lase legăturile pe seama pasului 2). Cei care rămân proprii se golesc la pasul 4, ca cei completați.
    const reverted = new Set();
    for (const it of items.filter((i) => i.action === 'converted')) {
      const row = rows.get(it.id);
      if (row.kind !== 'own' || !unchanged(it) || used.has(it.id) || row.public_token != null) {
        out.kept++;
        continue;
      }
      try {
        await updatePigeon(accountId, it.id, { ...(await clearPatch(it)), kind: 'external' });
        reverted.add(it.id);
        out.reverted++;
      } catch (err) {
        if (!(err instanceof HttpError)) throw err;
        out.kept++;
      }
    }

    // 2. Legăturile completate (la porumbei existenți și la strămoșii făcuți proprii) care au încă valoarea pusă.
    const links = new Map(); // id → { f, m }: ce legături se golesc
    for (const it of items) {
      if (it.action === 'created') continue;
      const row = rows.get(it.id);
      const f = 'father_id' in it.fields && same(row.father_id, it.fields.father_id);
      const m = 'mother_id' in it.fields && same(row.mother_id, it.fields.mother_id);
      if (f || m) links.set(it.id, { f, m });
    }

    // 3. Porumbeii creați care pleacă: neschimbați, nefolosiți, iar fiecare copil legat de ei fie pleacă și el, fie își
    //    pierde legătura la pasul 2. Un copil care rămâne (folosit) își păstrează părinții, deci și pe ei.
    const doomed = new Set();
    for (const it of items.filter((i) => i.action === 'created')) {
      const row = rows.get(it.id);
      const extra = row.public_token != null || row.clutch_id != null || row.source_note != null || Object.keys(row.evaluation ?? {}).length > 0;
      if (unchanged(it) && !extra && !used.has(it.id)) doomed.add(it.id);
    }
    const children = doomed.size
      ? await all('SELECT id, father_id, mother_id FROM pigeons WHERE father_id = ANY(?::bigint[]) OR mother_id = ANY(?::bigint[])', [...doomed], [...doomed])
      : [];
    const linkGoes = (child, col) => (byId.get(child.id)?.action === 'created' ? doomed.has(child.id) : Boolean(links.get(child.id)?.[col === 'father_id' ? 'f' : 'm']));
    for (let changed = true; changed; ) {
      changed = false;
      for (const child of children) {
        for (const col of ['father_id', 'mother_id']) {
          if (doomed.has(child[col]) && !linkGoes(child, col)) {
            doomed.delete(child[col]);
            changed = true;
          }
        }
      }
    }
    out.deleted = doomed.size;
    out.kept += items.filter((i) => i.action === 'created').length - doomed.size;

    if (links.size) {
      const ids = [...links.keys()];
      await run(
        `UPDATE pigeons p SET father_id = CASE WHEN v.f THEN NULL ELSE p.father_id END, mother_id = CASE WHEN v.m THEN NULL ELSE p.mother_id END, updated_at = ?
           FROM unnest(?::bigint[], ?::boolean[], ?::boolean[]) AS v(id, f, m)
          WHERE p.id = v.id AND p.account_id = ?`,
        nowIso(), ids, ids.map((id) => links.get(id).f), ids.map((id) => links.get(id).m), accountId,
      );
    }
    // Porumbeii șterși n-au poze (pozele trimit la porumbel, deci l-ar fi păstrat): nimic de curățat în afara bazei.
    if (doomed.size) await run('DELETE FROM pigeons WHERE id = ANY(?::bigint[]) AND account_id = ?', [...doomed], accountId);

    // 4. Câmpurile completate la porumbeii existenți și la strămoșii rămași proprii (după legături și ștergeri: sexul se
    //    golește doar dacă nu mai e părinte). Un strămoș rămas propriu e numărat și în `kept`.
    for (const it of items.filter((i) => i.action === 'filled' || (i.action === 'converted' && !reverted.has(i.id)))) {
      let touched = links.has(it.id);
      const patch = await clearPatch(it);
      if (Object.keys(patch).length) {
        try {
          await updatePigeon(accountId, it.id, patch);
          touched = true;
        } catch (err) {
          if (!(err instanceof HttpError)) throw err;
        }
      }
      if (touched) out.cleared++;
    }

    await run('UPDATE excel_imports SET undone_at = ? WHERE id = ?', nowIso(), imp.id);
    return out;
  });
}

/** Șterge evidența importurilor mai vechi de 7 zile (porumbeii rămân). Întoarce câte importuri a șters. */
export async function pruneImports() {
  return (await run('DELETE FROM excel_imports WHERE created_at < ?', new Date(Date.now() - UNDO_MS).toISOString())).changes;
}

/** Curățarea evidenței: la 30 s după pornire, apoi la fiecare 6 ore. */
export function startImportCleanup() {
  const tick = () => pruneImports().catch((e) => console.error('[porumbar] Curățarea importurilor din Excel nu a rulat:', e.message)); // i18n: ro
  setTimeout(tick, 30_000).unref();
  setInterval(tick, 6 * 3600 * 1000).unref();
}
