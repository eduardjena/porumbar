// Momentele amintirilor pentru tratamente, în ora zonei contului (implicit România). Modul pur: fără bază de date.
import { BUCHAREST, localNow, atLocal } from './zones.js';

const DAY = 86400e3;
const HOUR = 3600e3;
const WINDOW = 3 * HOUR;

export const bucharestNow = (now) => localNow(now, BUCHAREST);
export const atBucharest = (date, hour) => atLocal(date, hour, BUCHAREST);

function shiftDate(date, days) {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d) + days * DAY).toISOString().slice(0, 10);
}

export function moments(t, zone = BUCHAREST) {
  if (t.cancelledOn) return [];
  const out = [];
  const add = (kind, onDate, hour) => out.push({ kind, onDate, at: atLocal(onDate, hour, zone) });
  add('inainte', shiftDate(t.startDate, -1), 19);
  if (t.days >= 2) add('ultima_zi', shiftDate(t.startDate, t.days - 1), 7);
  if (t.parentId != null) add('repetare', shiftDate(t.startDate, -3), 19);
  return out;
}

export function dueMoments(t, now, changedAt, zone = BUCHAREST) {
  return moments(t, zone).filter((m) => m.at <= now && now - m.at <= WINDOW && m.at >= changedAt);
}
