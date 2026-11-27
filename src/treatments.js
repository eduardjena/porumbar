import { one, all, run, insert, nowIso, tx } from './db.js';
import { HttpError, badRequest, notFound, text, oneOf, realDate } from './http.js';
import { ringOf } from './pigeons.js';
import { glue, ref, t } from './i18n.js';
import { TREATMENT_METHODS, TREATMENT_TARGETS, TREATMENT_SUGGESTIONS, codes } from './catalog.js';
import { todayIn, zoneOf } from './zones.js';

const MS_DAY = 86400_000;
const GONE = ['vandut', 'pierdut', 'mort'];
const GROUP_STATUS = { concurenti: 'concurent', reproducatori: 'reproducator', tineret: 'tanar' };
const SUGGESTIONS = new Set(codes(TREATMENT_SUGGESTIONS));

/** Data de azi în București (AAAA-LL-ZZ): doar unde nu se știe contul. */
export const todayBucharest = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Bucharest' });

/** Data de azi (AAAA-LL-ZZ) în țara contului cu limba `lang` (ro București, hu Budapesta, ja Tokyo). */
export const todayFor = (lang, now = new Date()) => todayIn(zoneOf(lang), now);

export function addDays(iso, n) {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + n * MS_DAY).toISOString().slice(0, 10);
}
const diffDays = (a, b) => Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / MS_DAY);

/** Ultima zi a tratamentului. */
export const endDate = (tr) => addDays(tr.start_date, tr.days - 1);

/** Data următorului tratament din lanț, sau null dacă nu se repetă. */
export function nextStart(tr) {
  if (tr.repeat_kind === 'zile') return addDays(tr.start_date, tr.repeat_days);
  if (tr.repeat_kind === 'an') {
    const [y, m, d] = tr.start_date.split('-').map(Number);
    const next = new Date(Date.UTC(y + 1, m - 1, d));
    if (next.getUTCMonth() !== m - 1) next.setUTCDate(0); // 29 februarie → 28 februarie
    return next.toISOString().slice(0, 10);
  }
  return null;
}

/** Următorul din lanț, dar mereu după `today`: ce a trecut deja nu se reface (fără lanț de tratamente din trecut). */
export function nextStartAfter(tr, today) {
  if (tr.repeat_kind === 'zile') {
    const n = Math.max(1, Math.floor(diffDays(today, tr.start_date) / tr.repeat_days) + 1);
    return addDays(tr.start_date, n * tr.repeat_days);
  }
  let cur = tr;
  let s = nextStart(cur);
  for (let i = 0; s && s <= today && i < 250; i++) {
    cur = { ...cur, start_date: s };
    s = nextStart(cur);
  }
  return s;
}

/** Data scrisă pentru om, ca pe ecran: ro 21.11.2026, hu 2026. 11. 21., en 21/11/2026, ja 2026/11/21 (fără zero în față). */
export function formatDate(iso, lang) {
  const [y, m, d] = iso.split('-');
  if (lang === 'ja') return `${y}/${Number(m)}/${Number(d)}`;
  if (lang === 'en') return `${d}/${m}/${y}`;
  return lang === 'hu' ? `${y}. ${m}. ${d}.` : `${d}.${m}.${y}`;
}

/** Numele afișat: eticheta sugestiei dacă `name` e un cod de sugestie, altfel textul omului. */
export const treatmentLabel = (name, lang) => (SUGGESTIONS.has(name) ? t(lang, `catalog.tratament_sugestie.${name}`) : name);

/** Textul intrării din jurnal (în limba dată). */
export function journalText(tr, lang) {
  const start = formatDate(tr.start_date, lang);
  const period = tr.days === 1 ? start : `${start}${glue(lang, ' – ')}${formatDate(endDate(tr), lang)}`;
  let out = t(lang, 'tratament.jurnal_text', {
    nume: treatmentLabel(tr.name, lang),
    mod: t(lang, `catalog.tratament_mod.${tr.method}`),
    perioada: period,
  });
  if (tr.note) out += t(lang, 'tratament.jurnal_nota', { nota: tr.note });
  if (tr.cancelled_on) out += t(lang, 'tratament.jurnal_oprit', { zi: formatDate(tr.cancelled_on, lang) });
  return out;
}

/** Porumbeii proprii ai unui grup, din starea de acum. */
export async function groupPigeonIds(accountId, target) {
  const status = GROUP_STATUS[target];
  const rows = status
    ? await all(`SELECT id FROM pigeons WHERE account_id = ? AND kind = 'own' AND status = ? ORDER BY id`, accountId, status)
    : await all(`SELECT id FROM pigeons WHERE account_id = ? AND kind = 'own' AND COALESCE(status, '') NOT IN (?, ?, ?) ORDER BY id`, accountId, ...GONE);
  return rows.map((r) => r.id);
}

const storedIds = async (id) => (await all('SELECT pigeon_id FROM treatment_pigeons WHERE treatment_id = ? ORDER BY pigeon_id', id)).map((r) => r.pigeon_id);

/** Cui i se dă: porumbeii aleși / fixați, sau (grup nefixat încă) numărul de acum. */
export async function recipientIds(tr) {
  if (tr.target === 'alesi' || tr.frozen_at) return storedIds(tr.id);
  return groupPigeonIds(tr.account_id, tr.target);
}

/** O intrare în jurnal pe porumbel din listă; cele ale porumbeilor scoși dispar. */
export async function syncJournal(row, lang) {
  const tr = await one('SELECT * FROM treatments WHERE id = ?', row.id);
  if (!tr) return;
  const ids = await storedIds(tr.id);
  const body = journalText(tr, lang);
  await run(
    `DELETE FROM journal_entries WHERE treatment_id = ? AND (pigeon_id NOT IN (SELECT pigeon_id FROM treatment_pigeons WHERE treatment_id = ?))`,
    tr.id, tr.id,
  );
  const have = new Set((await all('SELECT pigeon_id FROM journal_entries WHERE treatment_id = ?', tr.id)).map((r) => r.pigeon_id));
  await run('UPDATE journal_entries SET entry_date = ?, type = ?, text = ? WHERE treatment_id = ?', tr.start_date, tr.kind, body, tr.id);
  for (const pigeonId of ids) {
    if (have.has(pigeonId)) continue;
    await run(
      'INSERT INTO journal_entries (pigeon_id, account_id, entry_date, type, text, created_at, treatment_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      pigeonId, tr.account_id, tr.start_date, tr.kind, body, nowIso(), tr.id,
    );
  }
}

/**
 * Următorul tratament din lanț: aceeași țintă (la „aleși”, aceiași porumbei), neînghețat. `today`: ziua socotită
 * „azi” (verificarea orară o dă din ora ei, ca testele cu ora fixată să nu depindă de ceas).
 */
export async function createNextOccurrence(row, today = todayBucharest()) {
  const tr = await one('SELECT * FROM treatments WHERE id = ?', row.id);
  const start = nextStartAfter(tr, today);
  if (!start) throw new Error('Treatment does not repeat.');
  const now = nowIso();
  const id = await insert(
    `INSERT INTO treatments (account_id, name, kind, method, start_date, days, note, target, repeat_kind, repeat_days, parent_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    tr.account_id, tr.name, tr.kind, tr.method, start, tr.days, tr.note, tr.target, tr.repeat_kind, tr.repeat_days, tr.id, now, now,
  );
  if (tr.target === 'alesi') {
    await run('INSERT INTO treatment_pigeons (treatment_id, pigeon_id) SELECT ?, pigeon_id FROM treatment_pigeons WHERE treatment_id = ?', id, tr.id);
  }
  return id;
}

async function ensureNext(tr, today) {
  if (tr.repeat_kind && !tr.cancelled_on && !(await one('SELECT 1 FROM treatments WHERE parent_id = ?', tr.id))) await createNextOccurrence(tr, today);
}

const lockRow = (id) => one('SELECT * FROM treatments WHERE id = ? FOR UPDATE', id);

/**
 * Ziua de început: lista grupului se fixează, jurnalul se scrie, se planifică următorul din lanț. Rândul se blochează
 * și se recitește, ca două rulări simultane (verificarea din fundal, o citire, o modificare) să nu facă dublu; unul deja
 * fixat nu se mai fixează (decât cu `force`, la schimbarea țintei după început). `today` ca la createNextOccurrence.
 * Întoarce true dacă rularea aceasta l-a fixat.
 */
export function freezeTreatment(row, lang, { force = false, today = todayFor(lang) } = {}) {
  return tx(async () => {
    const tr = await lockRow(row.id);
    if (!tr || (tr.frozen_at && !force)) return false;
    // Oprit sau încă neînceput: nu e (încă) ziua lui de fixare.
    if (!force && (tr.cancelled_on || tr.start_date > today)) return false;
    if (tr.target !== 'alesi') {
      const ids = await groupPigeonIds(tr.account_id, tr.target);
      await run('DELETE FROM treatment_pigeons WHERE treatment_id = ?', tr.id);
      for (const pigeonId of ids) await run('INSERT INTO treatment_pigeons (treatment_id, pigeon_id) VALUES (?, ?)', tr.id, pigeonId);
    }
    await run('UPDATE treatments SET frozen_at = ? WHERE id = ?', nowIso(), tr.id);
    await syncJournal(tr, lang);
    await ensureNext(tr, today);
    return true;
  });
}

/** Prima citire de după ziua de început fixează tratamentele contului care n-au fost încă fixate. */
export async function freezeDue(accountId, lang) {
  const due = await all('SELECT id FROM treatments WHERE account_id = ? AND frozen_at IS NULL AND cancelled_on IS NULL AND start_date <= ?::date ORDER BY id', accountId, todayFor(lang));
  for (const d of due) await freezeTreatment(d, lang);
}

// ---- API ----

export const treatmentRow = async (accountId, id, { lock = false } = {}) => {
  const row = Number.isSafeInteger(Number(id)) ? await one(`SELECT * FROM treatments WHERE id = ? AND account_id = ?${lock ? ' FOR UPDATE' : ''}`, Number(id), accountId) : null;
  if (!row) throw notFound('eroare.tratament_negasit');
  return row;
};

function statusOf(tr, today) {
  if (tr.cancelled_on) return 'anulat';
  if (tr.start_date > today) return 'urmeaza';
  if (endDate(tr) < today) return 'gata';
  return 'in_curs';
}

export async function toTreatment(tr, lang, today = todayFor(lang)) {
  const status = statusOf(tr, today);
  const next = await one('SELECT id, frozen_at FROM treatments WHERE parent_id = ? ORDER BY id LIMIT 1', tr.id);
  return {
    id: tr.id,
    name: tr.name,
    label: treatmentLabel(tr.name, lang),
    kind: tr.kind,
    method: tr.method,
    startDate: tr.start_date,
    endDate: endDate(tr),
    days: tr.days,
    note: tr.note,
    target: tr.target,
    repeat: tr.repeat_kind === 'zile' ? { kind: 'zile', days: tr.repeat_days } : tr.repeat_kind === 'an' ? { kind: 'an' } : null,
    cancelledOn: tr.cancelled_on,
    status,
    day: status === 'in_curs' ? diffDays(today, tr.start_date) + 1 : null,
    count: (await recipientIds(tr)).length,
    nextId: next?.id ?? null,
    // Următorul încă neînceput: doar pe acesta îl șterg oprirea și ștergerea.
    nextPlanned: !!next && !next.frozen_at,
  };
}

const intIn = (value, min, max, field) => {
  if (!Number.isInteger(value) || value < min || value > max) throw badRequest('eroare.valoare_invalida_camp', { camp: ref(field) });
  return value;
};

function validRepeat(value) {
  if (value == null) return { kind: null, days: null };
  if (typeof value !== 'object') throw badRequest('eroare.valoare_invalida_camp', { camp: ref('camp.repetare') });
  const kind = oneOf(value.kind, ['zile', 'an'], 'camp.repetare');
  return kind === 'zile' ? { kind, days: intIn(value.days, 1, 365, 'camp.repetare') } : { kind, days: null };
}

/** Corpul unui tratament, validat; `pigeonIds` doar la „aleși” (unice). */
export function validateInput(b = {}) {
  const target = oneOf(b.target, codes(TREATMENT_TARGETS), 'camp.cui');
  let pigeonIds = null;
  if (target === 'alesi') {
    if (!Array.isArray(b.pigeonIds)) throw badRequest('eroare.valoare_invalida_camp', { camp: ref('camp.porumbei') });
    pigeonIds = [...new Set(b.pigeonIds.map((x) => (Number.isSafeInteger(x) && x > 0 ? x : null)))];
    if (pigeonIds.includes(null)) throw badRequest('eroare.tratament_porumbei');
  }
  const repeat = validRepeat(b.repeat);
  return {
    name: text(b.name, 'camp.nume', { max: 100 }),
    kind: oneOf(b.kind, ['tratament', 'vaccin'], 'camp.tip'),
    method: oneOf(b.method, codes(TREATMENT_METHODS), 'camp.mod'),
    startDate: realDate(b.startDate, 'camp.data_inceput'),
    days: intIn(b.days, 1, 60, 'camp.zile'),
    note: text(b.note, 'camp.nota', { max: 1000, optional: true }),
    target,
    pigeonIds,
    repeatKind: repeat.kind,
    repeatDays: repeat.days,
  };
}

/** Porumbeii aleși: ai contului, proprii, vii (cei deja din tratament rămân, chiar dacă între timp au plecat). */
async function checkChosen(accountId, ids, keep = []) {
  if (!ids.length) throw badRequest('eroare.grup_fara_porumbei');
  const ok = new Set((await all(
    `SELECT id FROM pigeons WHERE account_id = ? AND kind = 'own' AND id = ANY(?::bigint[]) AND (COALESCE(status, '') NOT IN (?, ?, ?) OR id = ANY(?::bigint[]))`,
    accountId, ids, ...GONE, keep,
  )).map((r) => r.id));
  if (ids.some((id) => !ok.has(id))) throw badRequest('eroare.tratament_porumbei');
}

async function replaceChosen(id, ids) {
  await run('DELETE FROM treatment_pigeons WHERE treatment_id = ?', id);
  for (const pigeonId of ids) await run('INSERT INTO treatment_pigeons (treatment_id, pigeon_id) VALUES (?, ?)', id, pigeonId);
}

export function createTreatment(accountId, lang, body) {
  const v = validateInput(body);
  return tx(async () => {
    if (v.target === 'alesi') await checkChosen(accountId, v.pigeonIds);
    else if (!(await groupPigeonIds(accountId, v.target)).length) throw badRequest('eroare.grup_fara_porumbei');
    const now = nowIso();
    const id = await insert(
      `INSERT INTO treatments (account_id, name, kind, method, start_date, days, note, target, repeat_kind, repeat_days, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      accountId, v.name, v.kind, v.method, v.startDate, v.days, v.note, v.target, v.repeatKind, v.repeatDays, now, now,
    );
    if (v.target === 'alesi') await replaceChosen(id, v.pigeonIds);
    const row = await one('SELECT * FROM treatments WHERE id = ?', id);
    if (row.start_date <= todayFor(lang)) await freezeTreatment(row, lang);
    return one('SELECT * FROM treatments WHERE id = ?', id);
  });
}

export function updateTreatment(accountId, lang, id, body) {
  const v = validateInput(body);
  return tx(async () => {
    const old = await treatmentRow(accountId, id, { lock: true });
    if (old.cancelled_on) throw new HttpError(409, 'eroare.tratament_oprit');
    const wasFrozen = !!old.frozen_at;
    const keep = await storedIds(old.id);
    let listChanged = old.target !== v.target;
    if (v.target === 'alesi') {
      await checkChosen(accountId, v.pigeonIds, keep);
      if (!listChanged) listChanged = v.pigeonIds.length !== keep.length || v.pigeonIds.some((x) => !keep.includes(x));
    } else if (!wasFrozen || listChanged) {
      if (!(await groupPigeonIds(accountId, v.target)).length) throw badRequest('eroare.grup_fara_porumbei');
    }
    await run(
      `UPDATE treatments SET name = ?, kind = ?, method = ?, start_date = ?, days = ?, note = ?, target = ?, repeat_kind = ?, repeat_days = ?, updated_at = ? WHERE id = ?`,
      v.name, v.kind, v.method, v.startDate, v.days, v.note, v.target, v.repeatKind, v.repeatDays, nowIso(), old.id,
    );
    // Următorul planificat (încă neînceput) se refă doar dacă s-a schimbat ce îl hotărăște (repetarea sau începutul);
    // altfel rămâne cum e, cu ce a modificat omul la el. Unul început deja rămâne al lui.
    const planChanged = old.repeat_kind !== v.repeatKind || old.repeat_days !== v.repeatDays || old.start_date !== v.startDate;
    if (planChanged) await run('DELETE FROM treatments WHERE parent_id = ? AND frozen_at IS NULL', old.id);
    if (v.target === 'alesi') {
      if (listChanged) await replaceChosen(old.id, v.pigeonIds);
    } else if (listChanged) {
      await run('DELETE FROM treatment_pigeons WHERE treatment_id = ?', old.id);
    }
    const row = await one('SELECT * FROM treatments WHERE id = ?', old.id);
    if (row.start_date > todayFor(lang)) {
      // Încă neînceput (sau mutat în viitor): fără listă fixată, fără jurnal, fără următor planificat.
      await run('DELETE FROM treatments WHERE parent_id = ? AND frozen_at IS NULL', old.id);
      if (wasFrozen) {
        await run('DELETE FROM journal_entries WHERE treatment_id = ?', old.id);
        await run('UPDATE treatments SET frozen_at = NULL WHERE id = ?', old.id);
        if (v.target !== 'alesi') await run('DELETE FROM treatment_pigeons WHERE treatment_id = ?', old.id);
      }
    } else if (wasFrozen && !listChanged) {
      await syncJournal(row, lang);
      await ensureNext(row, todayFor(lang));
    } else {
      await freezeTreatment(row, lang, { force: true });
    }
    return one('SELECT * FROM treatments WHERE id = ?', old.id);
  });
}

export function cancelTreatment(accountId, lang, id) {
  return tx(async () => {
    let row = await treatmentRow(accountId, id, { lock: true });
    const today = todayFor(lang);
    if (statusOf(row, today) !== 'in_curs') throw new HttpError(409, 'eroare.tratament_nu_e_in_curs');
    // Început azi, dar nefixat încă: întâi se fixează (lista și jurnalul), apoi se oprește.
    if (!row.frozen_at) {
      await freezeTreatment(row, lang);
      row = await one('SELECT * FROM treatments WHERE id = ?', row.id);
    }
    await run('UPDATE treatments SET cancelled_on = ?, updated_at = ? WHERE id = ?', today, nowIso(), row.id);
    await run('DELETE FROM treatments WHERE parent_id = ? AND frozen_at IS NULL', row.id);
    await syncJournal(row, lang);
    return one('SELECT * FROM treatments WHERE id = ?', row.id);
  });
}

export function deleteTreatment(accountId, id) {
  return tx(async () => {
    const row = await treatmentRow(accountId, id, { lock: true });
    await run('DELETE FROM treatments WHERE parent_id = ? AND frozen_at IS NULL', row.id);
    // Cel de dinainte rămâne, dar nu se mai repetă.
    if (row.parent_id) await run('UPDATE treatments SET repeat_kind = NULL, repeat_days = NULL WHERE id = ?', row.parent_id);
    await run('DELETE FROM treatments WHERE id = ?', row.id); // intrările din jurnal pleacă odată cu el (ON DELETE CASCADE)
  });
}

export async function listTreatments(accountId, lang, { stare, before } = {}) {
  const today = todayFor(lang);
  const where = ['account_id = ?'];
  const params = [accountId];
  let order = 'start_date, id';
  let limit = '';
  if (stare === 'in_curs') {
    where.push('cancelled_on IS NULL AND start_date <= ?::date AND start_date + days - 1 >= ?::date');
    params.push(today, today);
  } else if (stare === 'urmeaza') {
    where.push('cancelled_on IS NULL AND start_date > ?::date');
    params.push(today);
  } else if (stare === 'gata') {
    where.push('(cancelled_on IS NOT NULL OR start_date + days - 1 < ?::date)');
    params.push(today);
    order = 'start_date DESC, id DESC';
    limit = 'LIMIT 50';
    if (before != null && before !== '') {
      const b = Number.isSafeInteger(Number(before)) ? await one('SELECT start_date, id FROM treatments WHERE id = ? AND account_id = ?', Number(before), accountId) : null;
      if (!b) throw badRequest('eroare.valoare_invalida_camp', { camp: ref('camp.inainte_de') });
      where.push('(start_date, id) < (?::date, ?::bigint)');
      params.push(b.start_date, b.id);
    }
  } else {
    throw badRequest('eroare.valoare_invalida_camp', { camp: ref('camp.stare') });
  }
  const rows = await all(`SELECT * FROM treatments WHERE ${where.join(' AND ')} ORDER BY ${order} ${limit}`, ...params);
  return Promise.all(rows.map((r) => toTreatment(r, lang, today)));
}

export async function treatmentPigeons(tr) {
  const ids = await recipientIds(tr);
  if (!ids.length) return [];
  const rows = await all('SELECT * FROM pigeons WHERE id = ANY(?::bigint[]) ORDER BY ring_year DESC NULLS LAST, ring_number, id', ids);
  return rows.map((p) => ({ id: p.id, ring: ringOf(p), name: p.name, status: p.status }));
}
