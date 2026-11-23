import { atBucharest } from './treatment-schedule.js';

/*
 * Calendarul cuibului (design: docs/superpowers/specs/2026-11-23-calendar-cuib-design.md): momentele rămase ale unei
 * ponte (al doilea ou, mirarea, eclozarea, inelarea) și când se trimit amintirile. Modul pur: fără bază de date.
 * Zilele sunt `YYYY-MM-DD`, în ora României; amintirile: 19:00 în ajun, 07:00 în ultima zi de inelare.
 */

export const HATCH_DAYS = [17, 19]; // de la primul ou
export const RING_DAYS = [6, 8]; // de la eclozare
export const OPEN_DAYS = 45; // o ponte e deschisă cât primul ou are mai puțin de atât
export const CANDLE_DAY = 5; // mirarea: a 5-a zi după al doilea ou (după primul, la un singur ou)
export const SECOND_EGG = [2, 4]; // al doilea ou e așteptat de la +2; „Doar un ou?” de la +4
const AHEAD_DAYS = 3; // momentele mai îndepărtate nu se arată încă

const DAY = 86400e3;
const dayNum = (date) => Math.round(Date.parse(`${date}T00:00:00Z`) / DAY);
const addDays = (date, n) => new Date(Date.parse(`${date}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);

export function isOpen(c, today) {
  if (c.calendarClosedOn) return false;
  return dayNum(today) - dayNum(c.egg1On) < OPEN_DAYS;
}

// Ouăle încă bune: cele din ponte fără cele clocite sau sparte.
const goodEggs = (c) => (c.eggs ?? 0) - (c.infertile ?? 0) - (c.broken ?? 0);
const awaitsEgg2 = (c) => c.eggs === 2 && !c.egg2On;

// Zilele de început ale fiecărui moment încă de făcut: { kind, from, to }.
function pending(c) {
  const out = [];
  if (awaitsEgg2(c)) out.push({ kind: 'ou2', from: addDays(c.egg1On, SECOND_EGG[0]), to: null });
  if (!c.candledOn && !c.hatchedOn) {
    const base = c.eggs === 2 ? (c.egg2On ?? addDays(c.egg1On, SECOND_EGG[0])) : c.egg1On;
    out.push({ kind: 'mirare', from: addDays(base, CANDLE_DAY), to: null });
  }
  if (!c.hatchedOn && goodEggs(c) > 0) {
    out.push({ kind: 'eclozare', from: addDays(c.egg1On, HATCH_DAYS[0]), to: addDays(c.egg1On, HATCH_DAYS[1]) });
  }
  if (c.hatchedOn && (c.young ?? 0) < (c.hatched ?? 0)) {
    out.push({ kind: 'inelare', from: addDays(c.hatchedOn, RING_DAYS[0]), to: addDays(c.hatchedOn, RING_DAYS[1]) });
  }
  return out;
}

export function nestMoments(c, today) {
  if (!isOpen(c, today)) return [];
  const t = dayNum(today);
  const result = [];
  for (const p of pending(c)) {
    if (dayNum(p.from) - t > AHEAD_DAYS) continue;
    const m = { ...p };
    if (t < dayNum(p.from)) m.state = 'viitor';
    else if (p.to && t > dayNum(p.to)) m.state = 'intarziat';
    else m.state = 'azi';
    if (p.kind === 'ou2' && t >= dayNum(addDays(c.egg1On, SECOND_EGG[1]))) m.question = true;
    if (p.kind === 'inelare' && today === p.to) m.last = true;
    result.push(m);
  }
  return result;
}

export function reminderMoments(c) {
  if (c.calendarClosedOn) return [];
  const out = [];
  const eve = (kind, day) => {
    const onDate = addDays(day, -1);
    out.push({ kind, onDate, at: atBucharest(onDate, 19) });
  };
  for (const p of pending(c)) {
    eve(p.kind, p.from);
    if (p.kind === 'inelare') {
      eve('inelare_ultima_maine', p.to);
      out.push({ kind: 'inelare_ultima', onDate: p.to, at: atBucharest(p.to, 7) });
    }
  }
  return out.sort((a, b) => a.at - b.at);
}
