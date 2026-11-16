import { one, all, run, insert, tx, nowIso, lockAccount } from './db.js';
import { HttpError, badRequest, notFound, text, realDate } from './http.js';
import { createPigeon, getPigeon, getPigeonRow, loadNodes, toSummary } from './pigeons.js';
import { wrightCoi } from './genealogy.js';
import { parseRing, formatRing, ringKey } from './rings.js';
import { cleanFactors, factorsFromColor, inferHidden, predictColors } from './color-genetics.js';

/*
 * Reproducția (design: docs/superpowers/specs/2026-11-16-reproductie-design.md): perechi pe sezon, ponte, inelarea
 * puilor (devin porumbei cu părinții completați) și seriile de inele ale anului, din care se propune inelul următor.
 */

const HATCH_DAYS = [17, 19]; // de la primul ou
const RING_DAYS = [6, 8]; // de la eclozare
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
    throw badRequest(`Câmpul „${label}” este obligatoriu.`);
  }
  const n = typeof v === 'number' ? v : /^\d+$/.test(String(v).trim()) ? Number(v) : NaN;
  if (!Number.isInteger(n) || n < min || n > max) throw badRequest(`„${label}” trebuie să fie un număr între ${min} și ${max}.`);
  return n;
}

// ——— Perechi ———

const pairStatus = (p) => (p.separated_on ? 'despartita' : p.paired_on ? 'activa' : 'planificata');

async function pairPigeons(accountId, cockId, henId) {
  const cock = await getPigeonRow(accountId, cockId);
  const hen = await getPigeonRow(accountId, henId);
  if (cock.id === hen.id) throw badRequest('Alege doi porumbei diferiți.');
  if (cock.sex !== 'M') throw badRequest('Primul porumbel al perechii trebuie să fie mascul (sexul M pe fișa lui).');
  if (hen.sex !== 'F') throw badRequest('Al doilea porumbel al perechii trebuie să fie femelă (sexul F pe fișa lui).');
  return { cock, hen };
}

function parsePair(body, existing = null) {
  const pick = (k, f) => (body?.[k] === undefined ? f : body[k]);
  const pairedOn = optDate(pick('pairedOn', existing?.paired_on ?? null), 'Data împerecherii');
  const separatedOn = optDate(pick('separatedOn', existing?.separated_on ?? null), 'Data despărțirii');
  if (separatedOn && (!pairedOn || separatedOn < pairedOn)) throw badRequest('Despărțirea nu poate fi înainte de împerechere.');
  const seasonIn = pick('season', null);
  const season = pairedOn ? Number(pairedOn.slice(0, 4)) : seasonIn != null ? count(seasonIn, 'Sezonul', { min: 1990, max: 2100 }) : existing?.season ?? new Date().getFullYear();
  return {
    pairedOn,
    separatedOn,
    season,
    nest: text(pick('nest', existing?.nest ?? null), 'Cuibul', { max: 40, optional: true }),
    note: text(pick('note', existing?.note ?? null), 'Notă', { max: 1000, optional: true }),
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
  const s = season == null || season === '' ? new Date().getFullYear() : count(season, 'Sezonul', { min: 1990, max: 2100, optional: false });
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
  if (!row) throw notFound('Perechea nu a fost găsită.');
  return row;
};

async function checkDuplicatePair(accountId, cockId, henId, season, selfId = null) {
  if (await one('SELECT 1 FROM pairs WHERE account_id = ? AND cock_id = ? AND hen_id = ? AND season = ? AND id IS DISTINCT FROM ?', accountId, cockId, henId, season, selfId)) {
    throw new HttpError(409, `Perechea aceasta există deja în sezonul ${season}.`);
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
  infertile: row.infertile,
  broken: row.broken,
  hatchedOn: row.hatched_on,
  hatched: row.hatched,
  fosterPairId: row.foster_pair_id,
  foster: row.foster_pair_id ? (pairs.get(row.foster_pair_id) ?? null) : null,
  note: row.note,
  expectedHatch: row.hatched_on ? null : { from: addDays(row.egg1_on, HATCH_DAYS[0]), to: addDays(row.egg1_on, HATCH_DAYS[1]) },
  ringFrom: row.hatched_on ? addDays(row.hatched_on, RING_DAYS[0]) : null,
  ringTo: row.hatched_on ? addDays(row.hatched_on, RING_DAYS[1]) : null,
  young: youngByClutch.get(row.id) ?? [],
});

function parseClutch(body, existing = null) {
  const pick = (k, f) => (body?.[k] === undefined ? f : body[k]);
  const egg1On = realDate(pick('egg1On', existing?.egg1_on), 'Data primului ou');
  const egg2On = optDate(pick('egg2On', existing?.egg2_on ?? null), 'Data celui de-al doilea ou');
  if (egg2On && egg2On < egg1On) throw badRequest('Al doilea ou nu poate fi înaintea primului.');
  const eggs = count(pick('eggs', existing?.eggs ?? null), 'Câte ouă', { min: 1, max: 3, fallback: egg2On ? 2 : existing?.eggs ?? 2 });
  const hatchedOn = optDate(pick('hatchedOn', existing?.hatched_on ?? null), 'Data eclozării');
  if (hatchedOn && hatchedOn <= egg1On) throw badRequest('Puii nu pot ieși înainte de ou (sau în aceeași zi).');
  const hatched = count(pick('hatched', existing?.hatched ?? null), 'Câți pui au ieșit', { max: 3 });
  const infertile = count(pick('infertile', existing?.infertile ?? 0), 'Ouă limpezi', { max: 3, fallback: 0 });
  const broken = count(pick('broken', existing?.broken ?? 0), 'Ouă sparte', { max: 3, fallback: 0 });
  if ((hatched ?? 0) + infertile + broken > eggs) throw badRequest(`Puii ieșiți, ouăle limpezi și cele sparte nu pot fi mai multe decât ouăle (${eggs}).`);
  return { egg1On, egg2On, eggs, hatchedOn, hatched, infertile, broken, note: text(pick('note', existing?.note ?? null), 'Notă', { max: 1000, optional: true }) };
}

const getClutchRow = async (accountId, id) => {
  const row = Number.isSafeInteger(Number(id)) ? await one('SELECT * FROM clutches WHERE id = ? AND account_id = ?', Number(id), accountId) : null;
  if (!row) throw notFound('Ponta nu a fost găsită.');
  return row;
};

async function fosterId(accountId, value, ownPairId) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const row = await getPairRow(accountId, value);
  if (row.id === ownPairId) throw badRequest('Doica trebuie să fie altă pereche.');
  return row.id;
}

export async function createClutch(accountId, pairId, body) {
  const pair = await getPairRow(accountId, pairId);
  const c = parseClutch(body);
  const foster = (await fosterId(accountId, body?.fosterPairId, pair.id)) ?? null;
  const id = await insert(
    `INSERT INTO clutches (account_id, pair_id, egg1_on, egg2_on, eggs, hatched_on, hatched, infertile, broken, foster_pair_id, note, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    accountId, pair.id, c.egg1On, c.egg2On, c.eggs, c.hatchedOn, c.hatched, c.infertile, c.broken, foster, c.note, nowIso(),
  );
  return toClutch(await getClutchRow(accountId, id));
}

export async function updateClutch(accountId, id, body) {
  const row = await getClutchRow(accountId, id);
  const c = parseClutch(body, row);
  const young = (await one('SELECT count(*)::int AS n FROM pigeons WHERE clutch_id = ?', row.id)).n;
  if (c.hatched != null && c.hatched < young) throw badRequest(`Ai inelat deja ${young} pui din această pontă.`);
  const foster = await fosterId(accountId, body?.fosterPairId, row.pair_id);
  await run(
    `UPDATE clutches SET egg1_on = ?, egg2_on = ?, eggs = ?, hatched_on = ?, hatched = ?, infertile = ?, broken = ?, note = ?, foster_pair_id = ? WHERE id = ?`,
    c.egg1On, c.egg2On, c.eggs, c.hatchedOn, c.hatched, c.infertile, c.broken, c.note, foster === undefined ? row.foster_pair_id : foster, row.id,
  );
  return toClutch(await getClutchRow(accountId, row.id));
}

export async function deleteClutch(accountId, id) {
  const row = await getClutchRow(accountId, id);
  await run('DELETE FROM clutches WHERE id = ? AND account_id = ?', row.id, accountId);
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
    if (ringed >= limit) throw badRequest(`Din această pontă ${clutch.hatched != null ? 'au ieșit' : 'sunt'} ${limit} ${limit === 1 ? 'pui' : 'pui'}, toți inelați deja. Schimbă întâi câți pui au ieșit.`);
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
      throw new HttpError(409, 'Inelul acesta e deja în program cu alți părinți. Verifică inelul.');
    }
    await run('UPDATE pigeons SET father_id = ?, mother_id = ?, clutch_id = ?, updated_at = now() WHERE id = ?', pair.cock_id, pair.hen_id, clutch.id, row.id);
    return getPigeon(accountId, row.id);
  });
}

// ——— Seriile de inele ———

function seriesRing(value, label) {
  const raw = text(value, label, { max: 40 });
  const r = parseRing(raw);
  if (!r.ok || r.unringed || !/^\d+$/.test(r.number)) throw badRequest(`${label}: inelul nu poate fi citit. Scrie-l ca în exemplu: RO-26-800540.`);
  return r;
}

const ringOf = (s, n) => formatRing({ ok: true, unringed: false, country: s.country, year: s.year, club: s.club || null, number: String(n) });

const toSeries = (r) => ({ id: r.id, year: r.year, first: ringOf(r, r.first_number), last: ringOf(r, r.last_number), count: r.last_number - r.first_number + 1 });

export async function listSeries(accountId) {
  return (await all('SELECT * FROM ring_series WHERE account_id = ? ORDER BY year DESC, id', accountId)).map(toSeries);
}

export async function createSeries(accountId, body) {
  const a = seriesRing(body?.first, 'Primul inel');
  const b = seriesRing(body?.last, 'Ultimul inel');
  if (a.country !== b.country || a.year !== b.year || (a.club ?? '') !== (b.club ?? '')) throw badRequest('Primul și ultimul inel trebuie să fie din aceeași țară, același an (și același club).');
  const first = Number(a.number);
  const last = Number(b.number);
  if (last < first) throw badRequest('Ultimul inel trebuie să aibă numărul mai mare decât primul.');
  if (last - first + 1 > MAX_SERIES) throw badRequest(`O serie are cel mult ${MAX_SERIES} de inele.`);
  const id = await insert(
    'INSERT INTO ring_series (account_id, country, year, club, first_number, last_number, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    accountId, a.country, a.year, a.club ?? '', first, last, nowIso(),
  );
  return toSeries(await one('SELECT * FROM ring_series WHERE id = ?', id));
}

export async function deleteSeries(accountId, id) {
  const { changes } = Number.isSafeInteger(Number(id)) ? await run('DELETE FROM ring_series WHERE id = ? AND account_id = ?', Number(id), accountId) : { changes: 0 };
  if (!changes) throw notFound('Seria nu a fost găsită.');
}

/** Cel mai mic inel liber din seriile anului (nefolosit de niciun porumbel al contului), sau null. */
export async function nextRing(accountId, year) {
  const y = year == null || year === '' ? new Date().getFullYear() : count(year, 'Anul', { min: 1990, max: 2100, optional: false });
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
export async function pairColors(accountId, id) {
  const pair = await getPairRow(accountId, id);
  const sire = await colorFactors(accountId, await getPigeonRow(accountId, pair.cock_id));
  const dam = await colorFactors(accountId, await getPigeonRow(accountId, pair.hen_id));
  return { sire, dam, result: predictColors(sire, dam) };
}

/** Calculul pentru factorii corectați de om pe ecran. */
export function predictFromBody(body) {
  return predictColors(cleanFactors(body?.sire, 'M'), cleanFactors(body?.dam, 'F'));
}
