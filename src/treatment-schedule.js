// Momentele amintirilor pentru tratamente, în ora României. Modul pur: fără bază de date, fără importuri din aplicație.
const TZ = 'Europe/Bucharest';
const DAY = 86400e3;
const HOUR = 3600e3;
const WINDOW = 3 * HOUR;

const fmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
});

export function bucharestNow(now) {
  const p = Object.fromEntries(fmt.formatToParts(now).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour), minute: Number(p.minute) };
}

// Momentul UTC al orei locale `hour` din ziua `date`; decalajul (+2 / +3) se află pentru acea oră locală.
export function atBucharest(date, hour) {
  const [y, m, d] = date.split('-').map(Number);
  const wall = Date.UTC(y, m - 1, d, hour);
  for (const offset of [3, 2]) {
    const cand = new Date(wall - offset * HOUR);
    const l = bucharestNow(cand);
    if (l.date === date && l.hour === hour) return cand;
  }
  return new Date(wall - 2 * HOUR); // ora care nu există (salt înainte): după decalajul de iarnă
}

function shiftDate(date, days) {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d) + days * DAY).toISOString().slice(0, 10);
}

export function moments(t) {
  if (t.cancelledOn) return [];
  const out = [];
  const add = (kind, onDate, hour) => out.push({ kind, onDate, at: atBucharest(onDate, hour) });
  add('inainte', shiftDate(t.startDate, -1), 19);
  if (t.days >= 2) add('ultima_zi', shiftDate(t.startDate, t.days - 1), 7);
  if (t.parentId != null) add('repetare', shiftDate(t.startDate, -3), 19);
  return out;
}

export function dueMoments(t, now, changedAt) {
  return moments(t).filter((m) => m.at <= now && now - m.at <= WINDOW && m.at >= changedAt);
}
