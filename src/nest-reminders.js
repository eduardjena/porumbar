// Amintirile cuibului (design: docs/superpowers/specs/2026-11-23-calendar-cuib-design.md, „Amintirile”): ce trebuie
// amintit acum pentru pontele deschise și ce intră în emailul de seară. Trimiterea o face verificarea tratamentelor
// (treatment-reminders.js), în aceeași notificare și același email cu tratamentele.
import { all } from './db.js';
import { glue, t } from './i18n.js';
import { openClutches } from './breeding.js';
import { subscriptionOf } from './subscriptions.js';
import { isOpen, nestMoments, reminderMoments } from './nest-schedule.js';
import { BUCHAREST, langsIn, langsOutside } from './zones.js';

const HOUR = 3600e3;
const WINDOW = 3 * HOUR; // ca la tratamente: un moment ratat se mai trimite cel mult 3 ore
export const NEST_KIND_ORDER = { ou2: 0, mirare: 1, eclozare: 2, inelare: 3, inelare_ultima_maine: 4, inelare_ultima: 4 };

/**
 * Condiția SQL „contul cu limba din `column` e în zona `zone`” și parametrul ei, ca la `zoneOf`: o limbă
 * necunoscută e a Bucureștiului (o folosesc și amintirile tratamentelor).
 */
export function inZone(zone, column) {
  return zone === BUCHAREST
    ? { sql: `${column} <> ALL(?::text[])`, param: langsOutside(zone) }
    : { sql: `${column} = ANY(?::text[])`, param: langsIn(zone) };
}

// Momentul din calendar căruia îi aparține amintirea (ultima zi de inelare e tot inelarea).
const baseKind = (kind) => (kind.startsWith('inelare') ? 'inelare' : kind);

/** Cuibul (sau perechea, fără număr de cuib) al unei amintiri. */
const place = (o) => ({ nest: o.nest ?? null, label: o.label ?? null });

/**
 * Rândurile unei amintiri, în limba contului, câte unul pe fel de moment, cu toate cuiburile lui:
 * „Mâine pot ieși puii: cuibul 3, 5, 7”. Perechile fără număr de cuib se adaugă după cuiburile cu număr.
 * @param {{ kind: string, nest: string|null, label: string|null }[]} items
 */
export function groupNestItems(items, lang) {
  const byKind = new Map();
  for (const i of items) addTo(byKind, i.kind, i);
  return [...byKind].map(([kind, list]) => {
    const nests = [...new Set(list.filter((i) => i.nest).map((i) => String(i.nest)))]
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    const labels = [...new Set(list.filter((i) => !i.nest).map((i) => i.label))].sort((a, b) => a.localeCompare(b));
    const parts = [...(nests.length ? [t(lang, 'amintire.cuibul', { n: nests.join(glue(lang, ', ')) })] : []), ...labels];
    return { kind, text: t(lang, `amintire.cuib_${kind}`, { cuib: parts.join(glue(lang, ', ')) }) };
  }).sort(byNestKind);
}

/**
 * Pontele deschise ale conturilor din zona `zone` cu abonament activ (cele „doar citire” nu primesc amintiri de cuib),
 * cu limba. `today`: ziua de azi în zona aceea.
 */
async function activeClutches(today, now, zone) {
  const open = (await openClutches({ today })).filter((o) => isOpen(o.clutch, today));
  if (!open.length) return [];
  const ids = [...new Set(open.map((o) => o.accountId))];
  const z = inZone(zone, 'lang');
  const accounts = await all(`SELECT id, email, lang, subscription_start, subscription_end FROM accounts WHERE id = ANY(?::bigint[]) AND ${z.sql}`, ids, z.param);
  const active = new Map(accounts.filter((a) => subscriptionOf(a, now).active).map((a) => [a.id, a]));
  return open.filter((o) => active.has(o.accountId)).map((o) => ({ ...o, lang: active.get(o.accountId).lang }));
}

/** Momentele încă de făcut ale pontei, socotite acum (un moment trecut deja de om nu se mai amintește). */
const stillToDo = (c, today) => new Set(nestMoments(c, today).map((m) => m.kind));

function addTo(map, key, value) {
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(value);
}

/**
 * Amintirile de cuib sosite la `now`, pe cont, pentru conturile din zona `zone` (`today`: ziua de azi acolo): momentul
 * a venit (cel mult 3 ore în urmă), după ultima schimbare a pontei, și e încă de făcut. „Mâine e ultima zi de inelare”
 * nu intră: cine are telefonul primește ultima zi la 07:00, iar emailul de seară o ia din `nestEveningLines`.
 * @returns {Promise<Map<number, { clutchId: number, kind: string, onDate: string, lang: string, nest: string|null, label: string|null }[]>>}
 */
export async function nestDueItems(now, today, zone = BUCHAREST) {
  const out = new Map();
  for (const o of await activeClutches(today, now, zone)) {
    const changedAt = new Date(o.updatedAt);
    const todo = stillToDo(o.clutch, today);
    for (const m of reminderMoments(o.clutch, zone)) {
      if (m.kind === 'inelare_ultima_maine') continue;
      if (!(m.at <= now && now - m.at <= WINDOW && m.at >= changedAt)) continue;
      if (!todo.has(baseKind(m.kind))) continue;
      addTo(out, o.accountId, { clutchId: o.clutchId, kind: m.kind, onDate: m.onDate, lang: o.lang, ...place(o) });
    }
  }
  return out;
}

/**
 * Rezervă amintirile (INSERT … ON CONFLICT DO NOTHING RETURNING); întoarce doar ce a rezervat rularea aceasta. Un moment
 * al unei ponte se amintește o singură dată în total, chiar dacă i s-a mutat ziua (mirarea, după al doilea ou pus târziu).
 */
export async function claimNestNotices(items) {
  if (!items.length) return [];
  items.sort((a, b) => a.clutchId - b.clutchId || a.kind.localeCompare(b.kind) || a.onDate.localeCompare(b.onDate));
  const rows = await all(
    `INSERT INTO nest_notices (clutch_id, kind, on_date, sent_at)
     SELECT u.id, u.kind, u.on_date, now() FROM unnest(?::bigint[], ?::text[], ?::date[]) AS u(id, kind, on_date)
      WHERE NOT EXISTS (SELECT 1 FROM nest_notices n WHERE n.clutch_id = u.id AND n.kind = u.kind)
     ON CONFLICT DO NOTHING RETURNING clutch_id, kind, on_date`,
    items.map((i) => i.clutchId), items.map((i) => i.kind), items.map((i) => i.onDate),
  );
  const won = new Set(rows.map((r) => `${r.clutch_id}|${r.kind}|${r.on_date}`));
  return items.filter((i) => won.has(`${i.clutchId}|${i.kind}|${i.onDate}`));
}

/**
 * Rândurile de cuib ale emailului de seară din ziua `today` (`evening` = 19:00), pentru conturile din zona `zone`: ce
 * începe mâine și „mâine e ultima zi de inelare”, pentru pontele neschimbate după 19:00, încă de făcut, fără un moment
 * amintit deja în altă zi.
 * @returns {Promise<Map<number, { kind: string, text: string }[]>>}
 */
export async function nestEveningLines(today, evening, zone = BUCHAREST) {
  const out = new Map();
  const list = await activeClutches(today, evening, zone);
  if (!list.length) return out;
  const sent = await all(
    'SELECT clutch_id, kind FROM nest_notices WHERE clutch_id = ANY(?::bigint[]) AND on_date <> ?::date',
    list.map((o) => o.clutchId), today,
  );
  const sentElsewhere = new Set(sent.map((r) => `${r.clutch_id}|${r.kind}`));
  for (const o of list) {
    if (new Date(o.updatedAt) > evening) continue;
    const todo = stillToDo(o.clutch, today);
    for (const m of reminderMoments(o.clutch, zone)) {
      if (m.onDate !== today || m.at.getTime() !== evening.getTime()) continue;
      if (!todo.has(baseKind(m.kind)) || sentElsewhere.has(`${o.clutchId}|${m.kind}`)) continue;
      addTo(out, o.accountId, { kind: m.kind, lang: o.lang, ...place(o) });
    }
  }
  for (const [accountId, items] of out) out.set(accountId, groupNestItems(items, items[0].lang));
  return out;
}

/** Ordinea rândurilor de cuib: după moment, apoi după text. */
export const byNestKind = (a, b) => NEST_KIND_ORDER[a.kind] - NEST_KIND_ORDER[b.kind] || a.text.localeCompare(b.text);
