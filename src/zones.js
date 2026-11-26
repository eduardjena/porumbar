// Zona orară a contului, după limba lui (i18n/languages.json). Modul pur: îl folosesc și serverul, și interfața.
import languages from '../i18n/languages.json' with { type: 'json' };

export const BUCHAREST = 'Europe/Bucharest';
const HOUR = 3600e3;

const ZONES = new Map(languages.map((l) => [l.code, l.zone]));
const formatters = new Map();
const formatter = (zone) => {
  let f = formatters.get(zone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-GB', {
      timeZone: zone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    });
    formatters.set(zone, f);
  }
  return f;
};

export const zoneOf = (lang) => ZONES.get(lang) ?? BUCHAREST;

/** Zonele conturilor, fiecare o dată, București întâi (verificarea orară le ia pe rând). */
export const ACCOUNT_ZONES = [...new Set([BUCHAREST, ...languages.map((l) => zoneOf(l.code))])];

/** Limbile cunoscute din zona `zone` / din celelalte zone (o limbă necunoscută e a Bucureștiului). */
export const langsIn = (zone) => languages.map((l) => l.code).filter((c) => zoneOf(c) === zone);
export const langsOutside = (zone) => languages.map((l) => l.code).filter((c) => zoneOf(c) !== zone);

export function localNow(now, zone) {
  const p = Object.fromEntries(formatter(zone).formatToParts(now).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour), minute: Number(p.minute) };
}

export const todayIn = (zone, now = new Date()) => localNow(now, zone).date;

// Momentul UTC al orei locale `hour` din ziua `date`; decalajul se află din Intl, pentru acea oră locală.
export function atLocal(date, hour, zone) {
  const [y, m, d] = date.split('-').map(Number);
  const wall = Date.UTC(y, m - 1, d, hour);
  const offsets = new Set();
  for (const probe of [wall - 14 * HOUR, wall, wall + 14 * HOUR]) {
    const l = localNow(new Date(probe), zone);
    const [ly, lm, ld] = l.date.split('-').map(Number);
    offsets.add(Date.UTC(ly, lm - 1, ld, l.hour, l.minute) - Math.floor(probe / 60e3) * 60e3);
  }
  const sorted = [...offsets].sort((a, b) => b - a); // decalajul de vară (mai mare) întâi, ca înainte
  for (const off of sorted) {
    const cand = new Date(wall - off);
    const l = localNow(cand, zone);
    if (l.date === date && l.hour === hour) return cand;
  }
  return new Date(wall - sorted[sorted.length - 1]); // ora care nu există (salt înainte): după decalajul de iarnă
}
