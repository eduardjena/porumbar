import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { BUCHAREST, zoneOf, localNow, atLocal, todayIn } from '../src/zones.js';
import { atBucharest, moments } from '../src/treatment-schedule.js';
import { reminderMoments } from '../src/nest-schedule.js';

// Martor: atBucharest de dinainte de zone (bucla pe decalajele 3 și 2).
function atBucharestOld(date, hour) {
  const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: BUCHAREST, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit' });
  const local = (d) => { const p = Object.fromEntries(fmt.formatToParts(d).map((x) => [x.type, x.value])); return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) }; };
  const [y, m, d] = date.split('-').map(Number);
  const wall = Date.UTC(y, m - 1, d, hour);
  for (const offset of [3, 2]) {
    const cand = new Date(wall - offset * 3600e3);
    const l = local(cand);
    if (l.date === date && l.hour === hour) return cand;
  }
  return new Date(wall - 2 * 3600e3);
}

test('zoneOf: zona după limbă', () => {
  assert.equal(zoneOf('ro'), 'Europe/Bucharest');
  assert.equal(zoneOf('hu'), 'Europe/Budapest');
  assert.equal(zoneOf('ja'), 'Asia/Tokyo');
  assert.equal(zoneOf('xx'), 'Europe/Bucharest');
  assert.equal(zoneOf(undefined), 'Europe/Bucharest');
  assert.equal(zoneOf(null), 'Europe/Bucharest');
});

test('fiecare limbă are o zonă validă', () => {
  const langs = JSON.parse(fs.readFileSync(new URL('../i18n/languages.json', import.meta.url), 'utf8'));
  for (const l of langs) {
    assert.equal(typeof l.zone, 'string', l.code);
    assert.doesNotThrow(() => new Intl.DateTimeFormat('en', { timeZone: l.zone }), l.code);
  }
});

test('todayIn: ziua locală', () => {
  const now = new Date('2026-11-26T23:00:00Z');
  assert.equal(todayIn('Asia/Tokyo', now), '2026-11-27');
  assert.equal(todayIn('Europe/Bucharest', now), '2026-11-27');
  assert.equal(todayIn('Europe/Budapest', now), '2026-11-27');
  assert.equal(todayIn('Europe/Budapest', new Date('2026-11-26T22:00:00Z')), '2026-11-26');
});

test('localNow: data, ora, minutul', () => {
  assert.deepEqual(localNow(new Date('2026-11-26T23:30:00Z'), 'Asia/Tokyo'), { date: '2026-11-27', hour: 8, minute: 30 });
});

test('atLocal: momentul UTC al orei locale', () => {
  assert.equal(atLocal('2026-11-27', 19, 'Asia/Tokyo').toISOString(), '2026-11-27T10:00:00.000Z');
  assert.equal(atLocal('2026-11-27', 19, 'Europe/Budapest').toISOString(), '2026-11-27T18:00:00.000Z');
  assert.equal(atLocal('2026-07-01', 19, 'Europe/Budapest').toISOString(), '2026-07-01T17:00:00.000Z');
  assert.equal(atLocal('2026-07-01', 19, 'Europe/Bucharest').toISOString(), '2026-07-01T16:00:00.000Z');
  assert.equal(atLocal('2026-03-29', 3, 'Europe/Bucharest').toISOString(), atBucharest('2026-03-29', 3).toISOString());
});

test('atLocal pentru București = atBucharest de dinainte, pe un an întreg', () => {
  for (let d = Date.UTC(2026, 0, 1); d < Date.UTC(2027, 0, 1); d += 86400e3) {
    const day = new Date(d).toISOString().slice(0, 10);
    for (const h of [7, 19]) assert.equal(atLocal(day, h, BUCHAREST).getTime(), atBucharestOld(day, h).getTime(), `${day} ${h}`);
  }
});

test('moments și reminderMoments cu zonă', () => {
  assert.equal(moments({ startDate: '2026-11-28', days: 3, parentId: null }, 'Asia/Tokyo')[0].at.toISOString(), '2026-11-27T10:00:00.000Z');
  assert.equal(moments({ startDate: '2026-11-28', days: 3, parentId: null })[0].at.toISOString(), '2026-11-27T17:00:00.000Z');
  const c = { egg1On: '2026-11-01', eggs: 1 };
  const tokyo = reminderMoments(c, 'Asia/Tokyo');
  const ro = reminderMoments(c);
  assert.equal(tokyo.length, ro.length);
  assert.equal(tokyo[0].at.toISOString(), `${tokyo[0].onDate}T10:00:00.000Z`);
});
