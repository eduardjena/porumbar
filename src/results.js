import { one, all, insert, run, tx, nowIso } from './db.js';
import { ref } from './i18n.js';
import { HttpError, badRequest, notFound, text, oneOf, realDate } from './http.js';
import { RACE_CATEGORIES, RACE_LEVELS, codes, fold } from './catalog.js';
import { createPigeon, getPigeonRow, ringOf } from './pigeons.js';
import { parseRing, storedRingKey } from './rings.js';

/*
 * Rezultatele la concursuri introduse de mână (design: docs/superpowers/specs/2026-11-16-rezultate-manual-design.md).
 * Aceleași câmpuri ca clasamentul columba.ro, ca lipirea clasamentului (pasul următor) să completeze aceleași rânduri.
 * Calculate, nu salvate: timpul de zbor, viteza (dacă omul n-a scris-o), penalizarea (loc × 1000 / angajați),
 * coeficientul FCI (dacă omul nu l-a scris), „premiat” și rândul scurt de pe pedigree („1e Jud.-197KM-10023P-'26”).
 * Regulile (regulamentul Columba 2026, FCI): penalizarea și coeficientul cu 4 zecimale (afișate cu 2); coeficientul FCI
 * împarte la cel mult 5.000 de porumbei, fără plafon la Maraton și Extrem; premiați sunt primii 20% din angajați.
 */

const FCI_CAP = 5000;
const NO_CAP = new Set(['maraton', 'mare-fond']);
const PRIZE_SHARE = 0.2;
const MAX_ARRIVAL_DAY = 7; // Fond 5 zile, Maraton și Extrem 7

const round = (n, d) => Math.round(n * 10 ** d) / 10 ** d;

/** Un număr scris de om: 196.608, „196,608”, „ 12 ”. */
function number(value, label, { min, max, integer = false, optional = false }) {
  if (value === undefined || value === null || value === '') {
    if (optional) return null;
    throw badRequest('eroare.camp_obligatoriu', { camp: ref(label) });
  }
  const n = typeof value === 'number' ? value : typeof value === 'string' && /^\s*\d+([.,]\d+)?\s*$/.test(value) ? Number(value.trim().replace(',', '.')) : NaN;
  if (!Number.isFinite(n) || (integer && !Number.isInteger(n))) throw badRequest(integer ? 'eroare.numar_intreg' : 'eroare.numar', { camp: ref(label) });
  if (n < min || n > max) throw badRequest('eroare.intre', { camp: ref(label), min, max });
  return n;
}

/** Ora „10:15” sau „10:15:43” → „10:15:43”. */
function clock(value, label, { optional = true } = {}) {
  if (value === undefined || value === null || value === '') {
    if (optional) return null;
    throw badRequest('eroare.camp_obligatoriu', { camp: ref(label) });
  }
  const m = typeof value === 'string' ? /^\s*(\d{1,2})[:.](\d{2})(?:[:.](\d{2}))?\s*$/.exec(value) : null;
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59 || Number(m[3] ?? 0) > 59) throw badRequest('eroare.ora_forma', { camp: ref(label) });
  return `${m[1].padStart(2, '0')}:${m[2]}:${m[3] ?? '00'}`;
}

const seconds = (t) => t.split(':').reduce((acc, x) => acc * 60 + Number(x), 0);

function parseRace(body) {
  if (!body || typeof body !== 'object') throw badRequest('eroare.lipsa_concurs');
  const race = {
    number: number(body.number, 'camp.nr_concurs', { min: 1, max: 9999, integer: true, optional: true }),
    organizer: text(body.organizer, 'camp.organizator', { max: 120 }),
    category: oneOf(body.category, codes(RACE_CATEGORIES), 'camp.categoria'),
    date: realDate(body.date, 'camp.data_concurs'),
    releasePlace: text(body.releasePlace, 'camp.locul_lansarii', { max: 120 }),
    releaseTime: clock(body.releaseTime, 'camp.ora_lansarii'),
    entered: number(body.entered, 'camp.porumbei_angajati', { min: 1, max: 200000, integer: true, optional: true }),
    level: body.level == null || body.level === '' ? null : oneOf(body.level, codes(RACE_LEVELS), 'camp.clasamentul'),
  };
  // Nivelul intră în cheie doar când e ales: concursurile de dinainte rămân aceleași.
  race.key = [fold(race.organizer), race.date, fold(race.releasePlace), race.category, ...(race.level ? [race.level] : [])].join('|');
  return race;
}

function parseResult(body) {
  const arrival = body?.arrival && typeof body.arrival === 'object' ? body.arrival : {};
  const time = clock(arrival.time, 'camp.ora_sosirii');
  return {
    place: number(body?.place, 'camp.locul', { min: 1, max: 200000, integer: true }),
    distanceM: Math.round(number(body?.distanceKm, 'camp.distanta_km', { min: 0.1, max: 3000 }) * 1000),
    arrivalDay: time ? number(arrival.day ?? 1, 'camp.ziua_sosirii', { min: 1, max: MAX_ARRIVAL_DAY, integer: true }) : null,
    arrivalTime: time,
    speed: number(body?.speed, 'camp.viteza', { min: 50, max: 3000, optional: true }),
    fci: number(body?.fci, 'camp.coeficient', { min: 0, max: 1000000, optional: true }),
    onPedigree: body?.onPedigree !== false,
  };
}

/** Concursul contului cu aceeași cheie, sau unul nou; ce se știe în plus (nr., ora, angajați) se completează. */
async function upsertRace(accountId, r) {
  return one(
    `INSERT INTO races (account_id, race_key, number, organizer, category, race_date, release_place, release_time, entered, level, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (account_id, race_key) DO UPDATE SET
       number = COALESCE(EXCLUDED.number, races.number),
       release_time = COALESCE(EXCLUDED.release_time, races.release_time),
       entered = COALESCE(EXCLUDED.entered, races.entered)
     RETURNING *`,
    accountId, r.key, r.number, r.organizer, r.category, r.date, r.releasePlace, r.releaseTime, r.entered, r.level, nowIso(),
  );
}

const toRace = (r) => ({
  id: r.id,
  number: r.number,
  organizer: r.organizer,
  category: r.category,
  date: r.race_date,
  releasePlace: r.release_place,
  releaseTime: r.release_time,
  entered: r.entered,
  level: r.level ?? null,
});

const LEVEL_SHORT = Object.fromEntries(RACE_LEVELS.map((l) => [l.code, l.short]));

/** Rândul scurt de pe pedigree: „1e-197KM-10023P-'26”, cu clasamentul: „1e Jud.-197KM-10023P-'26”. */
export const shortLine = (place, distanceM, entered, date, level = null) =>
  [[`${place}e`, LEVEL_SHORT[level]].filter(Boolean).join(' '), `${Math.round(distanceM / 1000)}KM`, entered ? `${entered}P` : null, `'${String(date).slice(2, 4)}`]
    .filter(Boolean)
    .join('-');

/** Coeficientul FCI: loc × 1000 / angajați, cu cel mult 5.000 de angajați (fără plafon la Maraton și Extrem). */
const fciOf = (place, entered, category) => (entered ? round((place * 1000) / (NO_CAP.has(category) ? entered : Math.min(entered, FCI_CAP)), 4) : null);

/** Rezultatul cu ce se calculează (rândul unui JOIN race_results + races). */
function toResult(row) {
  const race = toRace({ ...row, id: row.race_id });
  let flightMinutes = null;
  if (race.releaseTime && row.arrival_time && row.arrival_day === 1) {
    const s = seconds(row.arrival_time) - seconds(race.releaseTime);
    if (s > 0) flightMinutes = round(s / 60, 4);
  }
  return {
    id: row.id,
    pigeonId: row.pigeon_id,
    race,
    place: row.place,
    distanceM: row.distance_m,
    arrival: row.arrival_time ? { day: row.arrival_day, time: row.arrival_time } : null,
    flightMinutes,
    speedEntered: row.speed,
    speed: row.speed ?? (flightMinutes ? round(row.distance_m / flightMinutes, 2) : null),
    // Din ziua a 2-a noaptea se scade din zbor: viteza se ia din clasament, nu se calculează aici.
    speedFromSheet: row.speed == null && (row.arrival_day ?? 1) >= 2 && !!row.arrival_time,
    penalty: race.entered ? round((row.place * 1000) / race.entered, 4) : null,
    fciEntered: row.fci,
    fci: row.fci ?? fciOf(row.place, race.entered, race.category),
    prized: race.entered ? row.place <= Math.ceil(race.entered * PRIZE_SHARE) : null,
    onPedigree: row.on_pedigree,
    short: shortLine(row.place, row.distance_m, race.entered, race.date, race.level),
  };
}

const SELECT = `SELECT rr.*, r.number, r.organizer, r.category, r.race_date, r.release_place, r.release_time, r.entered, r.level
                  FROM race_results rr JOIN races r ON r.id = rr.race_id`;

export async function listResults(accountId, pigeonId) {
  const rows = await all(`${SELECT} WHERE rr.pigeon_id = ? AND rr.account_id = ? ORDER BY r.race_date DESC, rr.id DESC`, pigeonId, accountId);
  return rows.map(toResult);
}

const MAX_ALL = 3000;

/**
 * Toate rezultatele contului, cu porumbelul fiecăruia (fila Rezultate de pe Panou), cele mai noi întâi.
 * Ordonarea după rezultat / viteză o face interfața.
 */
export async function listAllResults(accountId) {
  const rows = await all(
    `SELECT rr.*, r.number, r.organizer, r.category, r.race_date, r.release_place, r.release_time, r.entered, r.level,
            p.name AS p_name, p.sex AS p_sex, p.ring_raw, p.ring_key, p.ring_country, p.ring_year, p.ring_club, p.ring_number
       FROM race_results rr JOIN races r ON r.id = rr.race_id JOIN pigeons p ON p.id = rr.pigeon_id
      WHERE rr.account_id = ? ORDER BY r.race_date DESC, rr.place, rr.id DESC LIMIT ${MAX_ALL}`,
    accountId,
  );
  return rows.map((row) => ({ ...toResult(row), pigeon: { id: row.pigeon_id, name: row.p_name, sex: row.p_sex, ring: ringOf(row) } }));
}

/** Rândurile scurte bifate „pe pedigree”, pentru toți porumbeii contului (id → [rânduri], cele mai noi întâi). */
export async function pedigreeLines(accountId) {
  const rows = await all(`${SELECT} WHERE rr.account_id = ? AND rr.on_pedigree ORDER BY r.race_date DESC, rr.place`, accountId);
  const out = new Map();
  for (const row of rows) {
    const r = toResult(row);
    out.set(row.pigeon_id, [...(out.get(row.pigeon_id) ?? []), r.short]);
  }
  return out;
}

const getResult = async (accountId, id) => {
  const row = Number.isSafeInteger(Number(id)) ? await one(`${SELECT} WHERE rr.id = ? AND rr.account_id = ?`, Number(id), accountId) : null;
  if (!row) throw notFound('eroare.rezultat_negasit');
  return row;
};

/** Scrie rezultatul (nou sau schimbat) în aceeași tranzacție cu concursul lui. */
async function save(accountId, pigeonId, body, resultId = null) {
  const race = parseRace(body?.race);
  const res = parseResult(body);
  const id = await tx(async () => {
    const r = await upsertRace(accountId, race);
    if (r.entered && res.place > r.entered) throw badRequest('eroare.loc_prea_mare', { loc: res.place, angajati: r.entered });
    const dup = await one('SELECT id FROM race_results WHERE race_id = ? AND pigeon_id = ? AND id <> ?', r.id, pigeonId, resultId ?? 0);
    if (dup) throw new HttpError(409, 'eroare.rezultat_dublu');
    const values = [r.id, res.place, res.distanceM, res.arrivalDay, res.arrivalTime, res.speed, res.fci, res.onPedigree];
    if (resultId) {
      await run(
        `UPDATE race_results SET race_id = ?, place = ?, distance_m = ?, arrival_day = ?, arrival_time = ?, speed = ?, fci = ?, on_pedigree = ?
          WHERE id = ? AND account_id = ?`,
        ...values, resultId, accountId,
      );
      return resultId;
    }
    return insert(
      `INSERT INTO race_results (race_id, place, distance_m, arrival_day, arrival_time, speed, fci, on_pedigree, account_id, pigeon_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ...values, accountId, pigeonId, nowIso(),
    );
  });
  return toResult(await getResult(accountId, id));
}

export const addResult = (accountId, pigeonId, body) => save(accountId, pigeonId, body);

export async function updateResult(accountId, id, body) {
  const row = await getResult(accountId, id);
  const result = await save(accountId, row.pigeon_id, body, row.id);
  await pruneRaces(accountId);
  return result;
}

/** Concursurile rămase fără niciun rezultat dispar din listă (de ex. după ștergerea singurului rezultat). */
const pruneRaces = (accountId) =>
  run('DELETE FROM races r WHERE r.account_id = ? AND NOT EXISTS (SELECT 1 FROM race_results rr WHERE rr.race_id = r.id)', accountId);

export async function deleteResult(accountId, id) {
  const row = await getResult(accountId, id);
  await run('DELETE FROM race_results WHERE id = ? AND account_id = ?', row.id, accountId);
  await pruneRaces(accountId);
}

/**
 * Concursurile contului (cele mai noi întâi), ca al doilea porumbel să aleagă concursul în loc să-l retasteze.
 * `distanceM` = distanța ultimului rezultat (același porumbar, același loc de lansare: aceeași distanță data viitoare).
 */
export async function listRaces(accountId) {
  const rows = await all(
    `SELECT r.*, (SELECT rr.distance_m FROM race_results rr WHERE rr.race_id = r.id ORDER BY rr.id DESC LIMIT 1) AS last_distance
       FROM races r WHERE r.account_id = ? ORDER BY r.race_date DESC, r.id DESC LIMIT 200`,
    accountId,
  );
  return rows.map((r) => ({ ...toRace(r), distanceM: r.last_distance ?? null }));
}

const MAX_ROWS = 300;

/**
 * Mai mulți porumbei la același concurs, deodată (scrierea de mână cu un singur număr și lipirea clasamentului).
 * Rândul: { pigeonId } sau { newPigeon: { ring, sex? } } (lipirea: inelul omului care nu e încă în program), plus locul
 * și, opțional, distanța, sosirea, viteza și coeficientul din clasament. Distanța comună vine din `distanceKm`.
 * Totul într-o tranzacție (o greșeală nu lasă jumătăți); rezultatele deja trecute se sar („dublu”).
 */
export async function saveMany(accountId, body) {
  const race = parseRace(body?.race);
  const rows = Array.isArray(body?.rows) ? body.rows : [];
  if (!rows.length || rows.length > MAX_ROWS) throw badRequest('eroare.lipsa_rezultate', { max: MAX_ROWS });
  const source = body?.source === 'lipit' ? 'lipit' : 'manual';
  const parsed = rows.map((row) => ({ row, res: parseResult({ ...row, distanceKm: row?.distanceKm ?? body?.distanceKm }) }));
  return tx(async () => {
    const r = await upsertRace(accountId, race);
    const ids = [];
    const skipped = [];
    for (const [index, { row, res }] of parsed.entries()) {
      const pigeonId = await pigeonOf(accountId, row);
      if (r.entered && res.place > r.entered) throw badRequest('eroare.loc_prea_mare', { loc: res.place, angajati: r.entered });
      if (await one('SELECT 1 FROM race_results WHERE race_id = ? AND pigeon_id = ?', r.id, pigeonId)) {
        skipped.push({ index, reason: 'dublu' });
        continue;
      }
      ids.push(
        await insert(
          `INSERT INTO race_results (race_id, place, distance_m, arrival_day, arrival_time, speed, fci, on_pedigree, account_id, pigeon_id, source, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          r.id, res.place, res.distanceM, res.arrivalDay, res.arrivalTime, res.speed, res.fci, res.onPedigree, accountId, pigeonId, source, nowIso(),
        ),
      );
    }
    const results = ids.length ? (await all(`${SELECT} WHERE rr.id = ANY(?::bigint[]) ORDER BY rr.id`, ids)).map(toResult) : [];
    return { added: ids.length, skipped, results };
  });
}

/** Porumbelul rândului: al contului, după id, sau după inel (cel existent ori unul nou, al omului). */
async function pigeonOf(accountId, row) {
  if (row?.pigeonId != null) return (await getPigeonRow(accountId, row.pigeonId)).id;
  const ring = typeof row?.newPigeon?.ring === 'string' ? row.newPigeon.ring : '';
  // Și un inel nerecunoscut: porumbelul propriu cu aceeași scriere (cheia de rezervă) sau unul nou.
  const key = storedRingKey(parseRing(ring));
  if (!key) throw badRequest('eroare.scrie_inelul');
  const found = await one(`SELECT id FROM pigeons WHERE account_id = ? AND ring_key = ? ORDER BY (kind = 'own') DESC, id LIMIT 1`, accountId, key);
  if (found) return found.id;
  const sex = row.newPigeon.sex === 'M' || row.newPigeon.sex === 'F' ? row.newPigeon.sex : undefined;
  return (await createPigeon(accountId, { kind: 'own', ring, ...(sex ? { sex } : {}) })).id;
}
