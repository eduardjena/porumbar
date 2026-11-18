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
  // myloft: inele germane cu anul în față și inele austriece (AUS) cu club.
  ['DV 17-01063-813 F', { country: 'DV', year: 2017, club: '1063', number: '813', sex: 'F' }],
  ['DV-10-01063-714 M', { country: 'DV', year: 2010, club: '1063', number: '714', sex: 'M' }],
  ['AUS 18-301-1405 M', { country: 'AT', year: 2018, club: '301', number: '1405', sex: 'M' }],
  ['AUS-11-335-216 F', { country: 'AT', year: 2011, club: '335', number: '216', sex: 'F' }],
  // Spania (ESP), țara la final după cratimă, anul întreg la final după țară.
  ['159989/19 ESP', { country: 'ES', year: 2019, number: '159989' }],
  ['0561385-2017-RO', { country: 'RO', year: 2017, number: '561385' }],
  ['1783831-2009-NL', { country: 'NL', year: 2009, number: '1783831' }],
  ['Ro 439175 - 2020', { country: 'RO', year: 2020, number: '439175' }],
  ['B 6024428 - 2019', { country: 'BE', year: 2019, number: '6024428' }],
  ['B 6203712-2012', { country: 'BE', year: 2012, number: '6203712' }],
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

test('inele cu club scrise cu anul în față: aceeași cheie ca forma obișnuită; afișare clară', () => {
  const k = (r) => ringKey(parseRing(r, { now }));
  assert.equal(k('DV 17-01063-813 F'), k('DV-01063-17-813'));
  assert.equal(formatRing(parseRing('DV 17-01063-813', { now })), 'DV-01063-17-813');
  assert.equal(formatRing(parseRing('AUS 18-301-1405 M', { now })), 'AT-18-301-1405');
  assert.equal(k('AUS 18-301-1405'), k('AT-18-301-1405'));
  assert.notEqual(k('AUS 18-301-1405'), k('AUS 18-302-1405'));
});

test('aceleași inele scrise pe pedigree-uri diferite dau aceeași cheie', () => {
  const k = (r) => ringKey(parseRing(r, { now }));
  assert.equal(k('0561385-2017-RO'), k('RO-17-561385'));
  assert.equal(k('B 6024428 - 2019'), k('BE-19-6024428'));
  assert.equal(k('159989/19 ESP'), k('ES-19-159989'));
});

// Inelele maghiare (docs/cercetare/reports/Aplicații columbofile în Ungaria.md): HU-AAAA-OO-NNNNN, cu OO = numărul
// organizatorului regional (două cifre) sau o literă de serie (D, P, N, M, R); sexul după inel: H (hím) / T (tojó).
const huCases = [
  ['HU-2023-29-14530', { country: 'HU', year: 2023, club: '29', number: '14530', sex: null }, 'HU-2023-29-14530'],
  ['HU-2023-29-14530 H', { country: 'HU', year: 2023, club: '29', number: '14530', sex: 'M' }, 'HU-2023-29-14530'],
  ['HU-2019-10-12345 T', { country: 'HU', year: 2019, club: '10', number: '12345', sex: 'F' }, 'HU-2019-10-12345'],
  ['HU 2019-10-12345', { country: 'HU', year: 2019, club: '10', number: '12345' }, 'HU-2019-10-12345'],
  ['HU-23-29-14530', { country: 'HU', year: 2023, club: '29', number: '14530' }, 'HU-2023-29-14530'],
  ['HU 2019 10 12345', { country: 'HU', year: 2019, club: '10', number: '12345' }, 'HU-2019-10-12345'],
  ['HU-2024-D-123456', { country: 'HU', year: 2024, club: 'D', number: '123456' }, 'HU-2024-D-123456'],
  ['HU-2024-M-12345 T', { country: 'HU', year: 2024, club: 'M', number: '12345', sex: 'F' }, 'HU-2024-M-12345'],
  ['HU-2023-04-41013 H', { country: 'HU', year: 2023, club: '04', number: '41013', sex: 'M' }, 'HU-2023-04-41013'],
  ['HU24-04-41013', { country: 'HU', year: 2024, club: '04', number: '41013' }, 'HU-2024-04-41013'],
];

test('inelele maghiare: numărul organizatorului (sau litera de serie) rămâne în inel, H / T e sexul', () => {
  for (const [text, want, shown] of huCases) {
    const r = parseRing(text, { now });
    assert.equal(r.ok, true, text);
    for (const [k, v] of Object.entries(want)) assert.equal(r[k], v, `${text}: ${k}`);
    assert.equal(formatRing(r), shown, text);
  }
});

test('două asociații diferite nu dau același inel; aceeași scriere în forme diferite dă același inel', () => {
  const a = ringKey(parseRing('HU-2023-29-14530', { now }));
  const b = ringKey(parseRing('HU-2023-10-14530', { now }));
  assert.notEqual(a, b);
  assert.equal(ringKey(parseRing('HU 23-29-14530 H', { now })), a);
});

test('un inel maghiar fără numărul asociației nu se acceptă (s-ar încurca cu alții)', () => {
  for (const text of ['14530/23 HU', 'HU-23-14530', 'HU 2023 14530']) {
    const r = parseRing(text, { now });
    assert.equal(r.ok, false, text);
    assert.equal(r.needsClub, true, text);
  }
});

test('inelele românești rămân neatinse de regulile maghiare', () => {
  assert.equal(formatRing(parseRing('RO-26-800546 H', { now })), 'RO-26-800546');
  assert.equal(parseRing('RO-26-800546 L', { now }).sex, 'M');
  assert.equal(formatRing(parseRing('RO 25 1326835', { now })), 'RO-25-1326835');
});
