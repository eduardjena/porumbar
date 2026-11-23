import { one, all, run, insert, tx, nowIso, lockAccount } from './db.js';
import { ref } from './i18n.js';
import { HttpError, badRequest, notFound, text, realDate } from './http.js';
import { createPigeon, getPigeon, getPigeonRow, loadNodes, toSummary } from './pigeons.js';
import { wrightCoi } from './genealogy.js';
import { parseRing, formatRing, ringKey } from './rings.js';
import { HATCH_DAYS, RING_DAYS, OPEN_DAYS, isOpen, nestMoments } from './nest-schedule.js';
import { cleanFactors, factorsFromColor, inferHidden, predictColors } from './color-genetics.js';

/*
 * Reproducția (design: docs/superpowers/specs/2026-11-16-reproductie-design.md): perechi pe sezon, ponte, inelarea
 * puilor (devin porumbei cu părinții completați) și seriile de inele ale anului, din care se propune inelul următor.
 */

const MAX_SERIES = 1000;

const addDays = (date, n) => {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

const optDate = (v, label) => (v === undefined || v === null || v === '' ? null : realDate(v, label));

function count(v, label, { min = 0, max = 3, optional = true, fallback = null } = {}) {
  if (v === undefined || v === null || v === '') {
    if (optional) return fallback;
    throw badRequest('eroare.camp_obligatoriu', { camp: ref(label) });
  }
  const n = typeof v === 'number' ? v : /^\d+$/.test(String(v).trim()) ? Number(v) : NaN;
  if (!Number.isInteger(n) || n < min || n > max) throw badRequest('eroare.numar_intre', { camp: ref(label), min, max });
  return n;
}

// ——— Perechi ———

const pairStatus = (p) => (p.separated_on ? 'despartita' : p.paired_on ? 'activa' : 'planificata');

async function pairPigeons(accountId, cockId, henId) {
  const cock = await getPigeonRow(accountId, cockId);
  const hen = await getPigeonRow(accountId, henId);
  if (cock.id === hen.id) throw badRequest('eroare.pereche_doi_diferiti');
  if (cock.sex !== 'M') throw badRequest('eroare.pereche_mascul');
  if (hen.sex !== 'F') throw badRequest('eroare.pereche_femela');
  return { cock, hen };
}

function parsePair(body, existing = null) {
  const pick = (k, f) => (body?.[k] === undefined ? f : body[k]);
  const pairedOn = optDate(pick('pairedOn', existing?.paired_on ?? null), 'camp.data_imperecherii');
  const separatedOn = optDate(pick('separatedOn', existing?.separated_on ?? null), 'camp.data_despartirii');
  if (separatedOn && (!pairedOn || separatedOn < pairedOn)) throw badRequest('eroare.despartire_inainte');
  const seasonIn = pick('season', null);
  const season = pairedOn ? Number(pairedOn.slice(0, 4)) : seasonIn != null ? count(seasonIn, 'camp.sezonul', { min: 1990, max: 2100 }) : existing?.season ?? new Date().getFullYear();
  return {
    pairedOn,
    separatedOn,
    season,
    nest: text(pick('nest', existing?.nest ?? null), 'camp.cuibul', { max: 40, optional: true }),
    note: text(pick('note', existing?.note ?? null), 'camp.nota', { max: 1000, optional: true }),
  };
}

const toPair = (row, pigeons, extra = {}) => ({
  id: row.id,
  season: row.season,
  status: pairStatus(row),
  pairedOn: row.paired_on,
  separatedOn: row.separated_on,
  nest: row.nest,
  note: row.note,
  cock: pigeons.get(row.cock_id) ?? null,
  hen: pigeons.get(row.hen_id) ?? null,
  ...extra,
});

async function pigeonMap(accountId, ids) {
  if (!ids.length) return new Map();
  const rows = await all('SELECT * FROM pigeons WHERE account_id = ? AND id = ANY(?::bigint[])', accountId, ids);
  return new Map(rows.map((r) => [r.id, toSummary(r)]));
}

const round = (x) => Math.round(x * 1e6) / 1e6;

export async function listPairs(accountId, season) {
  const s = season == null || season === '' ? new Date().getFullYear() : count(season, 'camp.sezonul', { min: 1990, max: 2100, optional: false });
  const rows = await all(
    `SELECT p.*, (SELECT count(*)::int FROM clutches c WHERE c.pair_id = p.id) AS clutch_count,
            (SELECT count(*)::int FROM pigeons y JOIN clutches c ON c.id = y.clutch_id WHERE c.pair_id = p.id) AS young_count
       FROM pairs p WHERE p.account_id = ? AND p.season = ?
      ORDER BY p.separated_on IS NOT NULL, p.paired_on IS NULL, p.nest NULLS LAST, p.id`,
    accountId, s,
  );
  const pigeons = await pigeonMap(accountId, rows.flatMap((r) => [r.cock_id, r.hen_id]));
  const nodes = rows.length ? await loadNodes(accountId) : null;
  return {
    season: s,
    seasons: (await all('SELECT DISTINCT season FROM pairs WHERE account_id = ? ORDER BY season DESC', accountId)).map((r) => r.season),
    pairs: rows.map((r) => toPair(r, pigeons, { clutchCount: r.clutch_count, youngCount: r.young_count, coi: round(wrightCoi(r.cock_id, r.hen_id, nodes).coi) })),
  };
}

const getPairRow = async (accountId, id) => {
  const row = Number.isSafeInteger(Number(id)) ? await one('SELECT * FROM pairs WHERE id = ? AND account_id = ?', Number(id), accountId) : null;
  if (!row) throw notFound('eroare.pereche_negasita');
  return row;
};

async function checkDuplicatePair(accountId, cockId, henId, season, selfId = null) {
  if (await one('SELECT 1 FROM pairs WHERE account_id = ? AND cock_id = ? AND hen_id = ? AND season = ? AND id IS DISTINCT FROM ?', accountId, cockId, henId, season, selfId)) {
    throw new HttpError(409, 'eroare.pereche_exista', { sezon: season });
  }
}

export async function createPair(accountId, body) {
  const { cock, hen } = await pairPigeons(accountId, body?.cockId, body?.henId);
  const p = parsePair(body);
  const id = await tx(async () => {
    await lockAccount(accountId);
    await checkDuplicatePair(accountId, cock.id, hen.id, p.season);
    return insert(
      `INSERT INTO pairs (account_id, cock_id, hen_id, season, paired_on, separated_on, nest, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      accountId, cock.id, hen.id, p.season, p.pairedOn, p.separatedOn, p.nest, p.note, nowIso(),
    );
  });
  return getPair(accountId, id);
}

export async function updatePair(accountId, id, body) {
  const row = await getPairRow(accountId, id);
  const p = parsePair(body, row);
  await tx(async () => {
    await lockAccount(accountId);
    await checkDuplicatePair(accountId, row.cock_id, row.hen_id, p.season, row.id);
    await run('UPDATE pairs SET season = ?, paired_on = ?, separated_on = ?, nest = ?, note = ? WHERE id = ?', p.season, p.pairedOn, p.separatedOn, p.nest, p.note, row.id);
  });
  return getPair(accountId, row.id);
}

export async function deletePair(accountId, id) {
  const row = await getPairRow(accountId, id);
  await run('DELETE FROM pairs WHERE id = ? AND account_id = ?', row.id, accountId);
}

// ——— Ponte ———

const toClutch = (row, youngByClutch = new Map(), pairs = new Map()) => ({
  id: row.id,
  pairId: row.pair_id,
  egg1On: row.egg1_on,
  egg2On: row.egg2_on,
  eggs: row.eggs,
  candledOn: row.candled_on,
  infertile: row.infertile,
  broken: row.broken,
  hatchedOn: row.hatched_on,
  hatched: row.hatched,
  fosterPairId: row.foster_pair_id,
  foster: row.foster_pair_id ? (pairs.get(row.foster_pair_id) ?? null) : null,
  note: row.note,
  calendarClosedOn: row.calendar_closed_on,
  updatedAt: row.updated_at,
  expectedHatch: row.hatched_on ? null : { from: addDays(row.egg1_on, HATCH_DAYS[0]), to: addDays(row.egg1_on, HATCH_DAYS[1]) },
  ringFrom: row.hatched_on ? addDays(row.hatched_on, RING_DAYS[0]) : null,
  ringTo: row.hatched_on ? addDays(row.hatched_on, RING_DAYS[1]) : null,
  young: youngByClutch.get(row.id) ?? [],
});

function parseClutch(body, existing = null) {
  const pick = (k, f) => (body?.[k] === undefined ? f : body[k]);
  const egg1On = realDate(pick('egg1On', existing?.egg1_on), 'camp.data_primului_ou');
  const egg2On = optDate(pick('egg2On', existing?.egg2_on ?? null), 'camp.data_ou_doi');
  if (egg2On && egg2On < egg1On) throw badRequest('eroare.ou_inainte');
  const candledOn = optDate(pick('candledOn', existing?.candled_on ?? null), 'camp.data_mirarii');
  if (candledOn && candledOn < egg1On) throw badRequest('eroare.mirare_inainte');
  const calendarClosedOn = optDate(pick('calendarClosedOn', existing?.calendar_closed_on ?? null), 'camp.nu_mai_urmaresc');
  const eggs = count(pick('eggs', existing?.eggs ?? null), 'camp.cate_oua', { min: 1, max: 3, fallback: egg2On ? 2 : existing?.eggs ?? 2 });
  const hatchedOn = optDate(pick('hatchedOn', existing?.hatched_on ?? null), 'camp.data_eclozarii');
  if (hatchedOn && hatchedOn <= egg1On) throw badRequest('eroare.pui_inainte_de_ou');
  const hatched = count(pick('hatched', existing?.hatched ?? null), 'camp.cati_pui', { max: 3 });
  const infertile = count(pick('infertile', existing?.infertile ?? 0), 'camp.oua_limpezi', { max: 3, fallback: 0 });
  const broken = count(pick('broken', existing?.broken ?? 0), 'camp.oua_sparte', { max: 3, fallback: 0 });
  if ((hatched ?? 0) + infertile + broken > eggs) throw badRequest('eroare.oua_prea_multe', { oua: eggs });
  return { egg1On, egg2On, eggs, candledOn, calendarClosedOn, hatchedOn, hatched, infertile, broken, note: text(pick('note', existing?.note ?? null), 'camp.nota', { max: 1000, optional: true }) };
}

const getClutchRow = async (accountId, id) => {
  const row = Number.isSafeInteger(Number(id)) ? await one('SELECT * FROM clutches WHERE id = ? AND account_id = ?', Number(id), accountId) : null;
  if (!row) throw notFound('eroare.ponta_negasita');
  return row;
};

async function fosterId(accountId, value, ownPairId) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const row = await getPairRow(accountId, value);
  if (row.id === ownPairId) throw badRequest('eroare.doica_alta');
  return row.id;
}

export async function createClutch(accountId, pairId, body) {
  const pair = await getPairRow(accountId, pairId);
  const c = parseClutch(body);
  const now = nowIso();
  const foster = (await fosterId(accountId, body?.fosterPairId, pair.id)) ?? null;
  const id = await insert(
    `INSERT INTO clutches (account_id, pair_id, egg1_on, egg2_on, eggs, candled_on, calendar_closed_on, hatched_on, hatched, infertile, broken, foster_pair_id, note, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    accountId, pair.id, c.egg1On, c.egg2On, c.eggs, c.candledOn, c.calendarClosedOn, c.hatchedOn, c.hatched, c.infertile, c.broken, foster, c.note, now, now,
  );
  return toClutch(await getClutchRow(accountId, id));
}

export async function updateClutch(accountId, id, body) {
  const row = await getClutchRow(accountId, id);
  const c = parseClutch(body, row);
  const young = (await one('SELECT count(*)::int AS n FROM pigeons WHERE clutch_id = ?', row.id)).n;
  if (c.hatched != null && c.hatched < young) throw badRequest('eroare.deja_inelati', { numar: young });
  const foster = await fosterId(accountId, body?.fosterPairId, row.pair_id);
  await run(
    `UPDATE clutches SET egg1_on = ?, egg2_on = ?, eggs = ?, candled_on = ?, calendar_closed_on = ?, hatched_on = ?, hatched = ?, infertile = ?, broken = ?, note = ?, foster_pair_id = ?, updated_at = ? WHERE id = ?`,
    c.egg1On, c.egg2On, c.eggs, c.candledOn, c.calendarClosedOn, c.hatchedOn, c.hatched, c.infertile, c.broken, c.note, foster === undefined ? row.foster_pair_id : foster, nowIso(), row.id,
  );
  return toClutch(await getClutchRow(accountId, row.id));
}

export async function deleteClutch(accountId, id) {
  const row = await getClutchRow(accountId, id);
  await run('DELETE FROM clutches WHERE id = ? AND account_id = ?', row.id, accountId);
}

// ——— Calendarul cuibului ———

const pigeonName = (p) => p?.name || p?.ring || '?';
// Textul unui cuib: numărul pus de crescător, altfel „mascul × femelă”.
const nestLabel = (pair, pigeons) => pair.nest || `${pigeonName(pigeons.get(pair.cock_id))} × ${pigeonName(pigeons.get(pair.hen_id))}`;

/**
 * Pontele deschise (primul ou de mai puțin de 45 de zile, neînchise cu „Nu mai urmări”) ale unui cont sau, fără
 * `accountId`, ale tuturor conturilor: `{ accountId, clutchId, pairId, label, fosterLabel, clutch, updatedAt }`.
 * Ponta cu doică stă la cuibul doicii (`pairId`, `label`), cu perechea proprie la `fosterLabel`.
 * `clutch` are forma din `nest-schedule.js`.
 */
export async function openClutches({ accountId = null, today }) {
  const rows = await all(
    `SELECT c.*, (SELECT count(*)::int FROM pigeons y WHERE y.clutch_id = c.id) AS young_count
       FROM clutches c
      WHERE c.calendar_closed_on IS NULL AND c.egg1_on > ?::date - ?::int AND (?::bigint IS NULL OR c.account_id = ?::bigint)
      ORDER BY c.id`,
    today, OPEN_DAYS, accountId, accountId,
  );
  const open = rows.filter((r) => isOpen({ egg1On: r.egg1_on, calendarClosedOn: r.calendar_closed_on }, today));
  if (!open.length) return [];
  const pairIds = [...new Set(open.flatMap((r) => [r.pair_id, r.foster_pair_id]).filter(Boolean))];
  const pairs = new Map((await all('SELECT * FROM pairs WHERE id = ANY(?::bigint[])', pairIds)).map((p) => [p.id, p]));
  const pigeonIds = [...new Set([...pairs.values()].flatMap((p) => [p.cock_id, p.hen_id]))];
  const pigeons = new Map((await all('SELECT * FROM pigeons WHERE id = ANY(?::bigint[])', pigeonIds)).map((r) => [r.id, toSummary(r)]));
  return open.map((r) => {
    const own = pairs.get(r.pair_id);
    const foster = r.foster_pair_id ? pairs.get(r.foster_pair_id) : null;
    return {
      accountId: r.account_id,
      clutchId: r.id,
      pairId: (foster ?? own).id,
      label: nestLabel(foster ?? own, pigeons),
      fosterLabel: foster ? nestLabel(own, pigeons) : null,
      clutch: {
        id: r.id, egg1On: r.egg1_on, egg2On: r.egg2_on, eggs: r.eggs, candledOn: r.candled_on, infertile: r.infertile, broken: r.broken,
        hatchedOn: r.hatched_on, hatched: r.hatched, young: r.young_count, calendarClosedOn: r.calendar_closed_on,
      },
      updatedAt: r.updated_at,
    };
  });
}

/** Ce are de făcut crescătorul cu cuiburile: momentele de azi și cele din următoarele zile, întârziatele întâi. */
export async function calendar(accountId, today) {
  const items = [];
  for (const o of await openClutches({ accountId, today })) {
    const c = o.clutch;
    for (const m of nestMoments(c, today)) {
      items.push({
        clutchId: o.clutchId,
        pairId: o.pairId,
        label: o.label,
        fosterLabel: o.fosterLabel,
        kind: m.kind,
        from: m.from,
        to: m.to,
        state: m.state,
        ...(m.last ? { last: true } : {}),
        ...(m.question ? { question: true } : {}),
        eggs: c.eggs,
        eggsLeft: c.eggs - c.infertile - c.broken,
        hatched: c.hatched,
        young: c.young,
      });
    }
  }
  const late = (i) => (i.state === 'intarziat' ? 0 : 1);
  return { today, items: items.sort((x, y) => late(x) - late(y) || x.from.localeCompare(y.from) || x.label.localeCompare(y.label, 'ro')) };
}

/** Perechea cu pontele ei (cele mai noi întâi), puii inelați din fiecare și consangvinizarea puilor. */
export async function getPair(accountId, id) {
  const row = await getPairRow(accountId, id);
  const clutches = await all('SELECT * FROM clutches WHERE pair_id = ? ORDER BY egg1_on DESC, id DESC', row.id);
  const young = clutches.length
    ? await all('SELECT * FROM pigeons WHERE account_id = ? AND clutch_id = ANY(?::bigint[]) ORDER BY ring_number, id', accountId, clutches.map((c) => c.id))
    : [];
  const youngByClutch = new Map();
  for (const y of young) youngByClutch.set(y.clutch_id, [...(youngByClutch.get(y.clutch_id) ?? []), toSummary(y)]);
  const fosterIds = [...new Set(clutches.map((c) => c.foster_pair_id).filter(Boolean))];
  const fosterRows = fosterIds.length ? await all('SELECT * FROM pairs WHERE account_id = ? AND id = ANY(?::bigint[])', accountId, fosterIds) : [];
  const pigeons = await pigeonMap(accountId, [row.cock_id, row.hen_id, ...fosterRows.flatMap((f) => [f.cock_id, f.hen_id])]);
  const fosters = new Map(fosterRows.map((f) => [f.id, toPair(f, pigeons)]));
  const coi = wrightCoi(row.cock_id, row.hen_id, await loadNodes(accountId));
  return toPair(row, pigeons, {
    coi: round(coi.coi),
    clutches: clutches.map((c) => toClutch(c, youngByClutch, fosters)),
  });
}

// ——— Inelarea puilor ———

export async function ringYoung(accountId, clutchId, body) {
  return tx(async () => {
    await lockAccount(accountId);
    const clutch = await getClutchRow(accountId, clutchId);
    const pair = await getPairRow(accountId, clutch.pair_id);
    const ringed = (await one('SELECT count(*)::int AS n FROM pigeons WHERE clutch_id = ?', clutch.id)).n;
    const limit = clutch.hatched ?? clutch.eggs;
    if (ringed >= limit) throw badRequest(clutch.hatched != null ? 'eroare.toti_inelati_iesiti' : 'eroare.toti_inelati_oua', { numar: limit });
    const pigeon = await createPigeon(accountId, {
      kind: 'own',
      ring: body?.ring,
      sex: body?.sex ?? null,
      name: body?.name ?? null,
      status: 'tanar',
      hatchedOn: clutch.hatched_on ?? null,
    });
    const row = await getPigeonRow(accountId, pigeon.id);
    if ((row.father_id && row.father_id !== pair.cock_id) || (row.mother_id && row.mother_id !== pair.hen_id)) {
      throw new HttpError(409, 'eroare.inel_alti_parinti');
    }
    await run('UPDATE pigeons SET father_id = ?, mother_id = ?, clutch_id = ?, updated_at = now() WHERE id = ?', pair.cock_id, pair.hen_id, clutch.id, row.id);
    return getPigeon(accountId, row.id);
  });
}

// ——— Seriile de inele ———

function seriesRing(value, label) {
  const raw = text(value, label, { max: 40 });
  const r = parseRing(raw);
  if (!r.ok || r.unringed || !/^\d+$/.test(r.number)) throw badRequest('eroare.inel_serie_necitit', { camp: ref(label) });
  return r;
}

const ringOf = (s, n) => formatRing({ ok: true, unringed: false, country: s.country, year: s.year, club: s.club || null, number: String(n) });

const toSeries = (r) => ({ id: r.id, year: r.year, first: ringOf(r, r.first_number), last: ringOf(r, r.last_number), count: r.last_number - r.first_number + 1 });

export async function listSeries(accountId) {
  return (await all('SELECT * FROM ring_series WHERE account_id = ? ORDER BY year DESC, id', accountId)).map(toSeries);
}

export async function createSeries(accountId, body) {
  const a = seriesRing(body?.first, 'camp.primul_inel');
  const b = seriesRing(body?.last, 'camp.ultimul_inel');
  if (a.country !== b.country || a.year !== b.year || (a.club ?? '') !== (b.club ?? '')) throw badRequest('eroare.serie_aceeasi_tara');
  const first = Number(a.number);
  const last = Number(b.number);
  if (last < first) throw badRequest('eroare.serie_ordine');
  if (last - first + 1 > MAX_SERIES) throw badRequest('eroare.serie_prea_lunga', { max: MAX_SERIES });
  const id = await insert(
    'INSERT INTO ring_series (account_id, country, year, club, first_number, last_number, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    accountId, a.country, a.year, a.club ?? '', first, last, nowIso(),
  );
  return toSeries(await one('SELECT * FROM ring_series WHERE id = ?', id));
}

export async function deleteSeries(accountId, id) {
  const { changes } = Number.isSafeInteger(Number(id)) ? await run('DELETE FROM ring_series WHERE id = ? AND account_id = ?', Number(id), accountId) : { changes: 0 };
  if (!changes) throw notFound('eroare.serie_negasita');
}

/** Cel mai mic inel liber din seriile anului (nefolosit de niciun porumbel al contului), sau null. */
export async function nextRing(accountId, year) {
  const y = year == null || year === '' ? new Date().getFullYear() : count(year, 'camp.anul', { min: 1990, max: 2100, optional: false });
  const series = await all('SELECT * FROM ring_series WHERE account_id = ? AND year = ? ORDER BY first_number, id', accountId, y);
  if (!series.length) return null;
  const used = new Set((await all('SELECT ring_key FROM pigeons WHERE account_id = ? AND ring_year = ? AND ring_key IS NOT NULL', accountId, y)).map((r) => r.ring_key));
  for (const s of series) {
    for (let n = s.first_number; n <= s.last_number; n++) {
      const raw = ringOf(s, n);
      if (!used.has(ringKey(parseRing(raw)))) return raw;
    }
  }
  return null;
}

// ——— Culorile probabile ale puilor ———

/** Factorii de culoare ai unui porumbel din fișa lui, cu ce poartă ascuns dedus din culorile părinților. */
async function colorFactors(accountId, row) {
  const parents = await all('SELECT id, sex, color FROM pigeons WHERE account_id = ? AND id = ANY(?::bigint[])', accountId, [row.father_id, row.mother_id].filter(Boolean));
  const of = (id) => parents.find((p) => p.id === id);
  const father = of(row.father_id);
  const mother = of(row.mother_id);
  return inferHidden(
    factorsFromColor(row.color, row.sex),
    father ? factorsFromColor(father.color, 'M') : null,
    mother ? factorsFromColor(mother.color, 'F') : null,
  );
}

/** Pentru perechea dată: factorii masculului și ai femelei (din fișe) și culorile probabile ale puilor. */
export async function pairColors(accountId, id, lang = 'ro') {
  const pair = await getPairRow(accountId, id);
  const sire = await colorFactors(accountId, await getPigeonRow(accountId, pair.cock_id));
  const dam = await colorFactors(accountId, await getPigeonRow(accountId, pair.hen_id));
  return { sire, dam, result: predictColors(sire, dam, lang) };
}

/** Calculul pentru factorii corectați de om pe ecran. */
export function predictFromBody(body, lang = 'ro') {
  return predictColors(cleanFactors(body?.sire, 'M'), cleanFactors(body?.dam, 'F'), lang);
}
