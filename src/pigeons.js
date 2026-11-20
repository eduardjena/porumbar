import { one, all, run, insert, tx, nowIso, lockAccount } from './db.js';
import { HttpError, badRequest, notFound, text, oneOf, realDate } from './http.js';
import { parseRing, formatRing, ringKey, fallbackKey, storedRingKey } from './rings.js';
import { BREEDS, COLORS, EYE_COLORS, STATUSES, EVAL_CRITERIA, codes, fold } from './catalog.js';

/*
 * Fișa porumbelului. Un rând e fie un porumbel propriu (unic în tot programul după inel), fie un strămoș extern
 * (porumbel al altcuiva care apare în pedigree-urile contului; unic doar în cont). Părinții pot fi oricare dintre ele.
 */

const KINDS = ['own', 'external'];
const MAX_LINES = 10;

export const ringOf = (row) =>
  row.ring_raw == null
    ? null
    : {
        raw: row.ring_raw,
        // Un inel nerecunoscut (cheia de rezervă „?|…”, fără țară) se arată cum a fost scris.
        display: row.ring_key && row.ring_country ? formatRing({ ok: true, country: row.ring_country, year: row.ring_year, club: row.ring_club, number: row.ring_number, raw: row.ring_raw }) : row.ring_raw,
        country: row.ring_country,
        year: row.ring_year,
        club: row.ring_club,
        number: row.ring_number,
      };

export function toPigeon(row) {
  return {
    id: row.id,
    kind: row.kind,
    ring: ringOf(row),
    sex: row.sex,
    name: row.name,
    breed: row.breed,
    lines: row.lines,
    color: row.color,
    colorPa: row.color_pa,
    colorText: row.color_text,
    eyeColor: row.eye_color,
    status: row.status,
    hatchedOn: row.hatched_on,
    breederText: row.breeder_text,
    pedigreeText: row.pedigree_text,
    sourceNote: row.source_note ?? null,
    fatherId: row.father_id,
    motherId: row.mother_id,
    evaluation: row.evaluation,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Anul nașterii: din data eclozării, altfel din inel; necunoscut → null. */
export const yearOf = (row) => (row.hatched_on ? Number(String(row.hatched_on).slice(0, 4)) : (row.ring_year ?? null));

export const toSummary = (row) => ({
  id: row.id,
  kind: row.kind,
  ring: ringOf(row),
  sex: row.sex,
  name: row.name,
  color: row.color,
  status: row.status,
  year: yearOf(row),
});

/** Rândul unui porumbel al contului, sau 404 (și pentru porumbeii altor conturi). */
export async function getPigeonRow(accountId, id) {
  const row = Number.isSafeInteger(Number(id)) ? await one('SELECT * FROM pigeons WHERE id = ? AND account_id = ?', Number(id), accountId) : null;
  if (!row) throw notFound('eroare.porumbel_negasit');
  return row;
}

export const getPigeon = async (accountId, id) => toPigeon(await getPigeonRow(accountId, id));

/** Toți porumbeii contului, ca noduri pentru genealogie. */
export async function loadNodes(accountId) {
  const rows = await all('SELECT id, father_id, mother_id FROM pigeons WHERE account_id = ?', accountId);
  return new Map(rows.map((r) => [r.id, { id: r.id, fatherId: r.father_id, motherId: r.mother_id }]));
}

const optCode = (value, list, field) => (value == null || value === '' ? null : oneOf(value, codes(list), field));

function validDate(value) {
  if (value == null || value === '') return null;
  return realDate(value, 'camp.data_eclozarii');
}

function validLines(value) {
  if (value == null) return [];
  if (!Array.isArray(value)) throw badRequest('eroare.linii_lista');
  // O listă uriașă e refuzată înainte de orice lucru (altfel o singură cerere ar ține serverul ocupat pentru toți).
  if (value.length > MAX_LINES * 3) throw badRequest('eroare.prea_multe_linii', { max: MAX_LINES });
  const out = [];
  const seen = new Set();
  for (const v of value) {
    const s = text(v, 'camp.linie', { max: 40, optional: true });
    if (s && !seen.has(fold(s))) seen.add(fold(s)), out.push(s);
  }
  if (out.length > MAX_LINES) throw badRequest('eroare.prea_multe_linii', { max: MAX_LINES });
  return out;
}

function validEvaluation(value) {
  if (value == null) return {};
  if (typeof value !== 'object' || Array.isArray(value)) throw badRequest('eroare.evaluare_invalida');
  const scores = {};
  for (const [k, v] of Object.entries(value.scores ?? {})) {
    oneOf(k, codes(EVAL_CRITERIA), 'camp.criteriu');
    if (v == null) continue;
    if (!Number.isInteger(v) || v < 1 || v > 5) throw badRequest('eroare.note_1_5');
    scores[k] = v;
  }
  return {
    scores,
    calitati: text(value.calitati, 'camp.calitati', { max: 2000, optional: true }),
    deDorit: text(value.deDorit, 'camp.de_dorit', { max: 2000, optional: true }),
    defecte: text(value.defecte, 'camp.defecte', { max: 2000, optional: true }),
  };
}

/** Fișa completă, validată, din câmpurile trimise peste cele existente (la PATCH). */
function validate(input, existing = null) {
  const pick = (key, fallback) => (input[key] === undefined ? fallback : input[key]);
  const kind = oneOf(pick('kind', existing?.kind ?? 'own'), KINDS, 'tip');

  const ringText = pick('ring', existing?.ring?.raw ?? null);
  const raw = ringText == null || String(ringText).trim() === '' ? null : text(ringText, 'camp.inel', { max: 80 });
  const ring = raw ? parseRing(raw) : null;
  // Un porumbel propriu are inel. Unul nerecunoscut se păstrează cum l-a scris omul (cheia de rezervă, ringKeyOf);
  // doar „fără inel”, textul fără nicio literă sau cifră („??”) și inelul maghiar fără organizator (numerele se repetă
  // între asociații) se refuză.
  if (kind === 'own' && (!ring || ring.unringed || ring.needsClub || (!ring.ok && !fallbackKey(ring)))) throw badRequest(ring?.needsClub ? 'eroare.inel_hu_asociatie' : 'eroare.inel_necitit');

  let sex = pick('sex', existing?.sex ?? null);
  if (sex === '') sex = null;
  if (sex != null) oneOf(sex, ['M', 'F'], 'camp.sex');
  if (sex == null && ring?.sex) sex = ring.sex;

  return {
    kind,
    ring,
    sex,
    name: text(pick('name', existing?.name), 'camp.nume', { max: 80, optional: true }),
    breed: optCode(pick('breed', existing?.breed ?? 'voiajor'), BREEDS, 'camp.rasa') ?? 'voiajor',
    lines: validLines(pick('lines', existing?.lines)),
    color: optCode(pick('color', existing?.color), COLORS, 'camp.culoare'),
    colorPa: Boolean(pick('colorPa', existing?.colorPa ?? false)),
    colorText: text(pick('colorText', existing?.colorText), 'camp.culoare_text', { max: 120, optional: true }),
    eyeColor: optCode(pick('eyeColor', existing?.eyeColor), EYE_COLORS, 'camp.culoarea_ochilor'),
    status: optCode(pick('status', existing?.status), STATUSES, 'camp.stare'),
    hatchedOn: validDate(pick('hatchedOn', existing?.hatchedOn)),
    breederText: text(pick('breederText', existing?.breederText), 'camp.crescator', { max: 200, optional: true }),
    pedigreeText: text(pick('pedigreeText', existing?.pedigreeText), 'camp.text_pedigree', { max: 2000, optional: true }),
    evaluation: input.evaluation === undefined ? (existing?.evaluation ?? {}) : validEvaluation(input.evaluation),
  };
}

/**
 * Cheia salvată: cea recunoscută; la un porumbel propriu și cea de rezervă a unui inel nerecunoscut („?|…”), ca dublurile
 * să fie găsite și așa. Strămoșii cu inel nerecunoscut rămân fără cheie, ca înainte (nu se leagă singuri de alții).
 */
const ringKeyOf = (p) => (p.kind === 'own' ? storedRingKey(p.ring) : ringKey(p.ring));

/**
 * Dublura după inel, doar în cont (separare totală: nimic nu spune unui crescător ce are altul): un inel e o singură
 * dată printre porumbeii proprii și o singură dată printre strămoșii „din alt porumbar”.
 */
async function checkDuplicate(accountId, p, selfId = null) {
  const key = ringKeyOf(p);
  if (!key) return;
  const display = formatRing(p.ring);
  if (p.kind === 'own') {
    if (await one(`SELECT 1 FROM pigeons WHERE kind = 'own' AND account_id = ? AND ring_key = ? AND id IS DISTINCT FROM ?`, accountId, key, selfId)) {
      throw new HttpError(409, 'eroare.inel_deja_la_tine', { inel: display });
    }
  } else if (await one(`SELECT 1 FROM pigeons WHERE kind = 'external' AND account_id = ? AND ring_key = ? AND id IS DISTINCT FROM ?`, accountId, key, selfId)) {
    throw new HttpError(409, 'eroare.inel_deja_la_tine', { inel: display });
  }
}

const searchText = (p) => fold([p.name, p.ring?.raw, p.ring?.ok && !p.ring.unringed ? formatRing(p.ring) : null].filter(Boolean).join(' '));

const columns = (p) => [
  p.kind,
  p.ring?.raw ?? null,
  ringKeyOf(p),
  p.ring?.ok ? p.ring.country : null,
  p.ring?.ok ? p.ring.year : null,
  p.ring?.ok ? p.ring.club : null,
  p.ring?.ok ? p.ring.number : null,
  p.sex, p.name, p.breed, p.lines, p.color, p.colorPa, p.colorText, p.eyeColor, p.status, p.hatchedOn,
  p.breederText, p.pedigreeText, JSON.stringify(p.evaluation), searchText(p),
];
const COLS = `kind, ring_raw, ring_key, ring_country, ring_year, ring_club, ring_number, sex, name, breed, lines, color, color_pa,
  color_text, eye_color, status, hatched_on, breeder_text, pedigree_text, evaluation, search_text`;

export async function createPigeon(accountId, input) {
  const p = validate(input ?? {});
  return tx(async () => {
    // Inelul există deja ca strămoș în cont (de ex. tatăl unui porumbel cumpărat, cumpărat și el acum):
    // devine porumbelul propriu, cu tot cu părinții și puii lui, ca genealogia să nu se rupă în două.
    const key = ringKey(p.ring);
    if (p.kind === 'own' && key) {
      const ext = await one(`SELECT id FROM pigeons WHERE account_id = ? AND kind = 'external' AND ring_key = ?`, accountId, key);
      if (ext) return updatePigeon(accountId, ext.id, { ...input, kind: 'own' });
    }
    await checkDuplicate(accountId, p);
    const now = nowIso();
    const id = await insert(
      `INSERT INTO pigeons (account_id, ${COLS}, created_at, updated_at) VALUES (?, ${COLS.split(',').map(() => '?').join(', ')}, ?, ?)`,
      accountId, ...columns(p), now, now,
    );
    return getPigeon(accountId, id);
  });
}

export async function updatePigeon(accountId, id, input) {
  return tx(async () => {
    const existing = await getPigeon(accountId, id);
    const p = validate(input ?? {}, existing);
    await checkDuplicate(accountId, p, existing.id);
    if (p.sex !== existing.sex) {
      const column = existing.sex === 'M' ? 'father_id' : existing.sex === 'F' ? 'mother_id' : null;
      if (column && (await one(`SELECT 1 FROM pigeons WHERE ${column} = ? LIMIT 1`, existing.id))) {
        throw badRequest(existing.sex === 'M' ? 'eroare.sex_e_tata' : 'eroare.sex_e_mama');
      }
    }
    const sets = COLS.split(',').map((c) => `${c.trim()} = ?`).join(', ');
    await run(`UPDATE pigeons SET ${sets}, updated_at = ? WHERE id = ?`, ...columns(p), nowIso(), existing.id);
    return getPigeon(accountId, existing.id);
  });
}

const pigeonDeleted = [];
/** Ce trebuie curățat în afara bazei când se șterge un porumbel (de ex. fișierele pozelor). */
export const whenPigeonDeleted = (fn) => pigeonDeleted.push(fn);

export async function deletePigeon(accountId, id) {
  await tx(async () => {
    await lockAccount(accountId);
    const row = await getPigeonRow(accountId, id);
    if (await one('SELECT 1 FROM pigeons WHERE father_id = ? OR mother_id = ? LIMIT 1', row.id, row.id)) {
      throw new HttpError(409, 'eroare.are_pui');
    }
    for (const fn of pigeonDeleted) await fn(row.id);
    await run('DELETE FROM pigeons WHERE id = ?', row.id);
  });
}

/** Lista porumbeilor contului, cu căutare după inel (în orice formă) sau nume și filtre. */
export async function listPigeons(accountId, { q, status, sex, year, kind } = {}) {
  const where = ['account_id = ?'];
  const params = [accountId];
  const query = String(q ?? '').trim();
  if (query) {
    const key = storedRingKey(parseRing(query));
    const digits = /^\d+$/.test(query) ? query.replace(/^0+(?=\d)/, '') : null;
    where.push(`(search_text LIKE ? OR ring_key = ? OR ring_number = ?)`);
    params.push(`%${fold(query).replace(/[%_\\]/g, (c) => `\\${c}`)}%`, key, digits);
  }
  if (status) where.push('status = ?') && params.push(oneOf(status, codes(STATUSES), 'camp.stare'));
  if (sex) where.push('sex = ?') && params.push(oneOf(sex, ['M', 'F'], 'camp.sex'));
  if (kind) where.push('kind = ?') && params.push(oneOf(kind, KINDS, 'camp.tip'));
  if (year) {
    const y = Number(year);
    if (!Number.isInteger(y)) throw badRequest('eroare.an_invalid');
    where.push('ring_year = ?');
    params.push(y);
  }
  const rows = await all(
    `SELECT * FROM pigeons WHERE ${where.join(' AND ')} ORDER BY kind, ring_year DESC NULLS LAST, ring_number, id LIMIT 1000`,
    ...params,
  );
  return rows.map(toSummary);
}
