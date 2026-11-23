import { test } from 'node:test';
import assert from 'node:assert/strict';
import { atBucharest } from '../src/treatment-schedule.js';
import { isOpen, nestMoments, reminderMoments } from '../src/nest-schedule.js';

// Ponta de bază: două ouă anunțate, al doilea încă nepus (date inventate).
const clutch = (o = {}) => ({
  id: 1, egg1On: '2026-05-01', egg2On: null, eggs: 2, candledOn: null, infertile: 0, broken: 0,
  hatchedOn: null, hatched: null, young: 0, calendarClosedOn: null, ...o,
});
const kind = (list, k) => list.find((m) => m.kind === k);

test('ou2: azi în ziua 2, „Doar un ou?” de la ziua 4, dispare cu un singur ou', () => {
  const m = kind(nestMoments(clutch(), '2026-05-03'), 'ou2');
  assert.equal(m.state, 'azi');
  assert.ok(!m.question);
  assert.equal(kind(nestMoments(clutch(), '2026-05-05'), 'ou2').question, true);
  assert.equal(kind(nestMoments(clutch({ eggs: 1 }), '2026-05-03'), 'ou2'), undefined);
});

test('mirare: ziua 5 după al doilea ou; la un ou, după primul; dispare când e făcută', () => {
  const two = clutch({ egg2On: '2026-05-03' });
  assert.equal(kind(nestMoments(two, '2026-05-06'), 'mirare').from, '2026-05-08');
  assert.equal(kind(nestMoments(clutch({ eggs: 1 }), '2026-05-04'), 'mirare').from, '2026-05-06');
  assert.equal(kind(nestMoments({ ...two, candledOn: '2026-05-08' }, '2026-05-08'), 'mirare'), undefined);
});

test('eclozare: zilele 17-19, întârziată după 19, fără ouă bune nu mai e', () => {
  const c = clutch({ egg2On: '2026-05-03' });
  const e = kind(nestMoments(c, '2026-05-18'), 'eclozare');
  assert.deepEqual([e.from, e.to, e.state], ['2026-05-18', '2026-05-20', 'azi']);
  assert.equal(kind(nestMoments(c, '2026-05-21'), 'eclozare').state, 'intarziat');
  assert.equal(kind(nestMoments({ ...c, infertile: 2 }, '2026-05-18'), 'eclozare'), undefined);
});

test('inelare: zilele 6-8 după eclozare, ultima zi, întârziată, dispare cu puii inelați', () => {
  const c = clutch({ egg2On: '2026-05-03', hatchedOn: '2026-05-19', hatched: 2, young: 0 });
  const i = kind(nestMoments(c, '2026-05-25'), 'inelare');
  assert.deepEqual([i.from, i.to, i.state], ['2026-05-25', '2026-05-27', 'azi']);
  assert.ok(!i.last);
  assert.equal(kind(nestMoments(c, '2026-05-27'), 'inelare').last, true);
  assert.equal(kind(nestMoments(c, '2026-05-28'), 'inelare').state, 'intarziat');
  assert.equal(kind(nestMoments({ ...c, young: 2 }, '2026-05-25'), 'inelare'), undefined);
  assert.equal(kind(nestMoments(c, '2026-05-25'), 'eclozare'), undefined);
});

test('moment la mai mult de 3 zile în viitor nu apare', () => {
  assert.equal(kind(nestMoments(clutch(), '2026-05-01'), 'eclozare'), undefined);
  assert.equal(kind(nestMoments(clutch(), '2026-05-15'), 'eclozare').state, 'viitor');
});

test('45 de zile peste anul nou și ponte închisă', () => {
  const c = clutch({ egg1On: '2026-12-20', egg2On: '2026-12-22' });
  assert.equal(isOpen(c, '2027-01-08'), true);
  assert.equal(kind(nestMoments(c, '2027-01-08'), 'eclozare').state, 'azi');
  assert.equal(isOpen(clutch({ egg1On: '2026-05-01' }), '2026-06-15'), false);
  assert.equal(isOpen(clutch({ egg1On: '2026-05-01' }), '2026-06-14'), true);
  const closed = clutch({ calendarClosedOn: '2026-05-10' });
  assert.equal(isOpen(closed, '2026-05-10'), false);
  assert.deepEqual(reminderMoments(closed), []);
});

test('reminderMoments: 19:00 în ajun, iar la ultima zi de inelare și 07:00', () => {
  const r = reminderMoments(clutch({ egg2On: '2026-05-03' }));
  const e = kind(r, 'eclozare');
  assert.equal(e.onDate, '2026-05-17');
  assert.equal(e.at.getTime(), atBucharest('2026-05-17', 19).getTime());
  const h = reminderMoments(clutch({ egg2On: '2026-05-03', hatchedOn: '2026-05-19', hatched: 2 }));
  const m = kind(h, 'inelare_ultima_maine');
  const u = kind(h, 'inelare_ultima');
  assert.equal(m.onDate, '2026-05-26');
  assert.equal(m.at.getTime(), atBucharest('2026-05-26', 19).getTime());
  assert.equal(u.onDate, '2026-05-27');
  assert.equal(u.at.getTime(), atBucharest('2026-05-27', 7).getTime());
  assert.equal(kind(h, 'inelare').onDate, '2026-05-24');
  assert.equal(kind(h, 'eclozare'), undefined);
});
