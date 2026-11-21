import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bucharestNow, atBucharest, moments, dueMoments } from '../src/treatment-schedule.js';

const base = { startDate: '2026-11-25', days: 1, repeat: null, cancelledOn: null, parentId: null };
const iso = (d) => d.toISOString().replace('.000Z', 'Z');

test('inainte: ziua dinaintea inceputului, la 19:00 (iarna UTC+2)', () => {
  const m = moments(base);
  assert.deepEqual(m.map((x) => x.kind), ['inainte']);
  assert.equal(m[0].onDate, '2026-11-24');
  assert.equal(iso(m[0].at), '2026-11-24T17:00:00Z');
});

test('ultima_zi: la 07:00 (vara UTC+3), doar de la 2 zile', () => {
  const m = moments({ ...base, startDate: '2026-07-01', days: 5 });
  const u = m.find((x) => x.kind === 'ultima_zi');
  assert.equal(u.onDate, '2026-07-05');
  assert.equal(iso(u.at), '2026-07-05T04:00:00Z');
  assert.equal(moments({ ...base, startDate: '2026-07-01', days: 1 }).some((x) => x.kind === 'ultima_zi'), false);
});

test('repetare: doar cu parentId, cu 3 zile inainte la 19:00', () => {
  assert.equal(moments(base).some((x) => x.kind === 'repetare'), false);
  const r = moments({ ...base, parentId: 7 }).find((x) => x.kind === 'repetare');
  assert.equal(r.onDate, '2026-11-22');
  assert.equal(iso(r.at), '2026-11-22T17:00:00Z');
});

test('anulat: niciun moment', () => {
  assert.deepEqual(moments({ ...base, days: 5, parentId: 1, cancelledOn: '2026-11-26' }), []);
});

test('atBucharest in zilele schimbarii orei', () => {
  assert.equal(iso(atBucharest('2027-03-28', 7)), '2027-03-28T04:00:00Z');
  assert.equal(iso(atBucharest('2026-10-25', 7)), '2026-10-25T05:00:00Z');
  assert.equal(iso(atBucharest('2027-03-27', 19)), '2027-03-27T17:00:00Z');
  assert.equal(iso(atBucharest('2027-03-28', 19)), '2027-03-28T16:00:00Z');
});

test('bucharestNow', () => {
  assert.deepEqual(bucharestNow(new Date('2027-03-28T16:30:00Z')), { date: '2027-03-28', hour: 19, minute: 30 });
  assert.deepEqual(bucharestNow(new Date('2026-12-31T22:05:00Z')), { date: '2027-01-01', hour: 0, minute: 5 });
});

test('ora de vara: evaluat din ora in ora, momentul inainte apare o singura data', () => {
  const t = { ...base, startDate: '2027-03-29' };
  const changedAt = new Date('2027-03-01T00:00:00Z');
  const seen = new Set();
  let all = 0;
  for (let h = Date.parse('2027-03-27T00:00:00Z'); h <= Date.parse('2027-03-29T23:00:00Z'); h += 3600e3) {
    for (const m of dueMoments(t, new Date(h), changedAt)) { seen.add(`${m.kind}|${m.onDate}|${iso(m.at)}`); all++; }
  }
  assert.deepEqual([...seen], ['inainte|2027-03-28|2027-03-28T16:00:00Z']);
  assert.ok(all >= 1);
  assert.equal(moments(t).filter((x) => x.kind === 'inainte').length, 1);
});

test('fereastra de 3 ore si changedAt', () => {
  const at = Date.parse('2026-11-24T17:00:00Z');
  const old = new Date('2026-11-01T00:00:00Z');
  assert.equal(dueMoments(base, new Date(at + (2 * 60 + 59) * 60e3), old).length, 1);
  assert.equal(dueMoments(base, new Date(at + (3 * 60 + 1) * 60e3), old).length, 0);
  assert.equal(dueMoments(base, new Date(at - 60e3), old).length, 0);
  assert.equal(dueMoments(base, new Date(at + 60e3), new Date(at + 1000)).length, 0);
  assert.equal(dueMoments(base, new Date(at + 60e3), new Date(at)).length, 1);
});
