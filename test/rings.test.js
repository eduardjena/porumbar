import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRing, formatRing, ringKey, ringFromColumba } from '../src/rings.js';

const now = new Date('2026-11-16');

const cases = [
  ['RO-26-800546 L', { country: 'RO', year: 2026, number: '800546', sex: 'M' }],
  ['RO-17-159927 T', { country: 'RO', year: 2017, number: '159927', sex: 'F' }],
  ['412084/15 RO', { country: 'RO', year: 2015, number: '412084', sex: null }],
  ['898910/09 RO M', { country: 'RO', year: 2009, number: '898910', sex: 'M' }],
  ['738256/09F', { country: 'RO', year: 2009, number: '738256', sex: 'F' }],
  ['RO 25 1326835', { country: 'RO', year: 2025, number: '1326835' }],
  ['RO-25-0276971', { country: 'RO', year: 2025, number: '276971' }],
  ['NL-11-1724956 L', { country: 'NL', year: 2011, number: '1724956', sex: 'M' }],
  ['5218055/02 NL M', { country: 'NL', year: 2002, number: '5218055', sex: 'M' }],
  ['6008107/08 BELG M', { country: 'BE', year: 2008, number: '6008107', sex: 'M' }],
  ['BE-25-2091885', { country: 'BE', year: 2025, number: '2091885' }],
  ['DV-08778-24-271', { country: 'DV', year: 2024, club: '8778', number: '271' }],
  ['DV-8778-24-262', { country: 'DV', year: 2024, club: '8778', number: '262' }],
  ['1441788/05 NL M', { country: 'NL', year: 2005, number: '1441788' }],
  ['NL-03-1395255 L', { country: 'NL', year: 2003, number: '1395255' }],
  ['123456/99 RO', { country: 'RO', year: 1999 }],
];

for (const [raw, exp] of cases) {
  test(`inel: ${raw}`, () => {
    const r = parseRing(raw, { now });
    assert.equal(r.ok, true);
    assert.equal(r.unringed, false);
    assert.equal(r.raw, raw);
    for (const [k, v] of Object.entries(exp)) assert.equal(r[k], v, k);
  });
}

test('fără inel', () => {
  for (const raw of ['000 M', '0000/07 RO M']) {
    const r = parseRing(raw, { now });
    assert.equal(r.ok, true, raw);
    assert.equal(r.unringed, true, raw);
  }
  assert.equal(parseRing('000 M', { now }).sex, 'M');
  assert.equal(ringKey(parseRing('000 M', { now })), null);
});

test('neinterpretabil', () => {
  const r = parseRing('Govaerts pedigreu distrus', { now });
  assert.equal(r.ok, false);
  assert.equal(r.raw, 'Govaerts pedigreu distrus');
  assert.equal(ringKey(r), null);
  assert.equal(parseRing('', { now }).ok, false);
});

test('aceeași cheie pentru forme diferite', () => {
  const k = (s) => ringKey(parseRing(s, { now }));
  assert.equal(k('RO-25-0276971'), k('276971/25 RO'));
  assert.equal(k('RO 25 276971'), k('RO-25-276971'));
  assert.equal(k('ro-25-276971'), k('RO-25-276971'));
  assert.equal(k('DV-08778-24-271'), k('DV-8778-24-271'));
  assert.notEqual(k('RO-25-276971'), k('RO-24-276971'));
  assert.notEqual(k('RO-25-276971'), k('NL-25-276971'));
  assert.equal(ringKey(ringFromColumba('0276971', 2025)), k('RO-25-276971'));
  assert.equal(ringKey(ringFromColumba('0276971', '2025')), k('RO-25-276971'));
});

test('afișare', () => {
  assert.equal(formatRing(parseRing('412084/15 RO', { now })), 'RO-15-412084');
  assert.equal(formatRing(parseRing('DV-8778-24-262', { now })), 'DV-08778-24-262');
  assert.equal(formatRing(parseRing('123456/99 RO', { now })), 'RO-99-123456');
});
