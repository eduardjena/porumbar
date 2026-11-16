import { one, all, insert, run, tx, nowIso } from './db.js';
import { HttpError, badRequest, notFound, text, oneOf, realDate } from './http.js';
import { RACE_CATEGORIES, codes, fold } from './catalog.js';

/*
 * Rezultatele la concursuri introduse de mână (design: docs/superpowers/specs/2026-11-16-rezultate-manual-design.md).
 * Aceleași câmpuri ca clasamentul columba.ro, ca lipirea clasamentului (pasul următor) să completeze aceleași rânduri.
 * Calculate, nu salvate: timpul de zbor, viteza (dacă omul n-a scris-o), penalizarea (loc × 1000 / angajați) și
 * rândul scurt de pe pedigree („1e-197KM-10023P-'26”).
 */

const round = (n, d) => Math.round(n * 10 ** d) / 10 ** d;

/** Un număr scris de om: 196.608, „196,608”, „ 12 ”. */
function number(value, label, { min, max, integer = false, optional = false }) {
  if (value === undefined || value === null || value === '') {
    if (optional) return null;
    throw badRequest(`Câmpul „${label}” este obligatoriu.`);
  }
  const n = typeof value === 'number' ? value : typeof value === 'string' && /^\s*\d+([.,]\d+)?\s*$/.test(value) ? Number(value.trim().replace(',', '.')) : NaN;
  if (!Number.isFinite(n) || (integer && !Number.isInteger(n))) throw badRequest(`„${label}” trebuie să fie un număr${integer ? ' întreg' : ''}.`);
  if (n < min || n > max) throw badRequest(`„${label}” trebuie să fie între ${min} și ${max}.`);
  return n;
}

/** Ora „10:15” sau „10:15:43” → „10:15:43”. */
function clock(value, label, { optional = true } = {}) {
  if (value === undefined || value === null || value === '') {
    if (optional) return null;
    throw badRequest(`Câmpul „${label}” este obligatoriu.`);
  }
  const m = typeof value === 'string' ? /^\s*(\d{1,2})[:.](\d{2})(?:[:.](\d{2}))?\s*$/.exec(value) : null;
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59 || Number(m[3] ?? 0) > 59) throw badRequest(`„${label}” trebuie să fie o oră de forma 10:15 sau 10:15:43.`);
  return `${m[1].padStart(2, '0')}:${m[2]}:${m[3] ?? '00'}`;
}

const seconds = (t) => t.split(':').reduce((acc, x) => acc * 60 + Number(x), 0);

function parseRace(body) {
  if (!body || typeof body !== 'object') throw badRequest('Lipsesc datele concursului.');
  const race = {
    number: number(body.number, 'Nr. concursului', { min: 1, max: 9999, integer: true, optional: true }),
    organizer: text(body.organizer, 'Organizator', { max: 120 }),
    category: oneOf(body.category, codes(RACE_CATEGORIES), 'Categoria'),
    date: realDate(body.date, 'Data concursului'),
    releasePlace: text(body.releasePlace, 'Locul lansării', { max: 120 }),
    releaseTime: clock(body.releaseTime, 'Ora lansării'),
    entered: number(body.entered, 'Porumbei angajați', { min: 1, max: 200000, integer: true, optional: true }),
  };
  race.key = [fold(race.organizer), race.date, fold(race.releasePlace), race.category].join('|');
  return race;
}

function parseResult(body) {
  const arrival = body?.arrival && typeof body.arrival === 'object' ? body.arrival : {};
  const time = clock(arrival.time, 'Ora sosirii');
  return {
    place: number(body?.place, 'Locul', { min: 1, max: 200000, integer: true }),
    distanceM: Math.round(number(body?.distanceKm, 'Distanța (km)', { min: 0.1, max: 3000 }) * 1000),
    arrivalDay: time ? number(arrival.day ?? 1, 'Ziua sosirii', { min: 1, max: 3, integer: true }) : null,
    arrivalTime: time,
    speed: number(body?.speed, 'Viteza (m/min)', { min: 50, max: 3000, optional: true }),
    fci: number(body?.fci, 'Coeficient FCI', { min: 0, max: 1000000, optional: true }),
    onPedigree: body?.onPedigree !== false,
  };
}

/** Concursul contului cu aceeași cheie, sau unul nou; ce se știe în plus (nr., ora, angajați) se completează. */
async function upsertRace(accountId, r) {
  return one(
    `INSERT INTO races (account_id, race_key, number, organizer, category, race_date, release_place, release_time, entered, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (account_id, race_key) DO UPDATE SET
       number = COALESCE(EXCLUDED.number, races.number),
       release_time = COALESCE(EXCLUDED.release_time, races.release_time),
       entered = COALESCE(EXCLUDED.entered, races.entered)
     RETURNING *`,
    accountId, r.key, r.number, r.organizer, r.category, r.date, r.releasePlace, r.releaseTime, r.entered, nowIso(),
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
});

/** Rândul scurt de pe pedigree: „1e-197KM-10023P-'26”. */
export const shortLine = (place, distanceM, entered, date) =>
  [`${place}e`, `${Math.round(distanceM / 1000)}KM`, entered ? `${entered}P` : null, `'${String(date).slice(2, 4)}`].filter(Boolean).join('-');

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
    penalty: race.entered ? round((row.place * 1000) / race.entered, 2) : null,
    fci: row.fci,
    onPedigree: row.on_pedigree,
    short: shortLine(row.place, row.distance_m, race.entered, race.date),
  };
}

const SELECT = `SELECT rr.*, r.number, r.organizer, r.category, r.race_date, r.release_place, r.release_time, r.entered
                  FROM race_results rr JOIN races r ON r.id = rr.race_id`;

export async function listResults(accountId, pigeonId) {
  const rows = await all(`${SELECT} WHERE rr.pigeon_id = ? AND rr.account_id = ? ORDER BY r.race_date DESC, rr.id DESC`, pigeonId, accountId);
  return rows.map(toResult);
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
  if (!row) throw notFound('Rezultatul nu a fost găsit.');
  return row;
};

/** Scrie rezultatul (nou sau schimbat) în aceeași tranzacție cu concursul lui. */
async function save(accountId, pigeonId, body, resultId = null) {
  const race = parseRace(body?.race);
  const res = parseResult(body);
  const id = await tx(async () => {
    const r = await upsertRace(accountId, race);
    if (r.entered && res.place > r.entered) throw badRequest(`Locul ${res.place} e mai mare decât numărul de porumbei angajați (${r.entered}).`);
    const dup = await one('SELECT id FROM race_results WHERE race_id = ? AND pigeon_id = ? AND id <> ?', r.id, pigeonId, resultId ?? 0);
    if (dup) throw new HttpError(409, 'Porumbelul are deja un rezultat la acest concurs. Schimbă-l pe cel existent.');
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

/** Concursurile contului (cele mai noi întâi), ca al doilea porumbel să aleagă concursul în loc să-l retasteze. */
export async function listRaces(accountId) {
  return (await all('SELECT * FROM races WHERE account_id = ? ORDER BY race_date DESC, id DESC LIMIT 200', accountId)).map(toRace);
}
