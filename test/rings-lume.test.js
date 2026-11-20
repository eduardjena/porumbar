import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRing, formatRing, ringKey, fallbackKey, storedRingKey } from '../src/rings.js';
import { WORLD } from './fixtures/inele-lume.js';

/*
 * Inelele din toată lumea (docs/cercetare/reports/Formatele inelelor de porumbei.md, design 2026-11-20-inele-lume):
 * exemple reale din raport → țara / emitentul canonic, anul, partea din mijloc (club, secție, literă de serie,
 * regiune, provincie, cod de club american), numărul și afișarea. Cheia scoate zerourile din față ale numărului.
 */
const now = new Date('2026-11-16');

for (const [raw, want, shown] of WORLD) {
  test(`inel din lume: ${raw}`, () => {
    const r = parseRing(raw, { now });
    assert.equal(r.ok, true, 'recunoscut');
    assert.equal(r.unringed, false);
    assert.equal(r.raw, raw);
    for (const [k, v] of Object.entries({ sex: null, ...want })) assert.equal(r[k], v, k);
    assert.equal(formatRing(r), shown, 'afișarea');
    // Afișarea se citește înapoi în același inel.
    assert.equal(ringKey(parseRing(shown, { now })), ringKey(r), 'afișarea dă aceeași cheie');
  });
}

const k = (raw) => ringKey(parseRing(raw, { now }));

test('aceeași pasăre scrisă în forme diferite dă aceeași cheie', () => {
  assert.equal(k('DV 1009 23 9V'), k('DV-01009-23-0009'));
  assert.equal(k('PL-025-23-1668'), k('PL-0025-23-1668'));
  assert.equal(k('GB17Z012345'), k('GB17Z12345'));
  assert.equal(k('FR21-006470'), k('FR-21-006470'));
  assert.equal(k('CZ 0156/11 - 442'), k('CZ-11-0156-442'));
  assert.equal(k('AUSTRIA 415 -18- 120'), k('AUS 18-415-120'));
  assert.equal(k('AUT-2025-413-743'), k('AT-25-413-743'));
  assert.equal(k('JPN 09 AB 12345'), k('JAPAN 2009 AB 12345'));
  assert.equal(k('C.T.R.P.A 2027 311605'), k('CTRPA-27-311605'));
  assert.equal(k('AU 18 RMR 18861'), k('18861 RMR AU 2018'));
  assert.equal(k('AU 18 RMR 18861'), k('AU-2018-RMR-18861'));
  assert.equal(k('UAE-2023-1-1600613'), k('AE-23-1-1600613'));
  assert.equal(k('CHN 26-15-0443185'), k('CHN-2026-15-0443185'));
});

test('coliziunile: AU = SUA, AUS = Austria, CU = Canada, PL-DE = Derby, IHU S ≠ GB S', () => {
  assert.equal(parseRing('AU 18 RMR 18861', { now }).country, 'AU');
  assert.equal(parseRing('AUS 18-301-1405', { now }).country, 'AT');
  assert.equal(parseRing('CU 17 9307', { now }).country, 'CU');
  assert.equal(parseRing('PL-DE-00-123456', { now }).country, 'PL');
  assert.notEqual(k('PL-DE-00-123456'), k('DV-00-123456'));
  assert.notEqual(k('IHU 09 S 76230'), k('GB09S76230'));
  assert.notEqual(k('JPN 09 AB 12345'), k('NIPPON 2009 12345'));
  assert.notEqual(k('KUW-2023-1-87664'), k('KUW-2023-2-87664'));
  // V / W sunt sexul doar după un inel german.
  assert.equal(parseRing('DV 1009 23 9V', { now }).number, '9');
  assert.equal(parseRing('RO 25 123456 V', { now }).ok, false);
});

test('ce raportul lasă nesigur rămâne nerecunoscut (se păstrează textul)', () => {
  for (const raw of [
    'SA-22-6338', // South Australia sau Africa de Sud: nu se ghicește
    'AUST 26 12345 0452538115', // cu numărul de telefon pe inel
    'RMR 25138', // fără emitent
    '09KA35132', // japonez fără prefix
    'RUS-77199-16-999', // Rusia: surse contradictorii
    'UN 2026 123456', // asociația taiwaneză UN: prea generic
    'UA 2225210 2024 рік',
    'NWHU2025-2546 BLUE HEN',
    'CAS 306/05',
    'PK24-GHL-16',
    'NOR 22 12345',
    '2019-45-0228879', // provincia chineză merge doar până la 33
    '2019-23-228879', // fără prefix: doar numărul chinezesc de 7 cifre
    'RO 2023 A 12345', // litera de federație românească: neconfirmată
    'HU20-14530', // maghiar fără organizator
  ]) {
    const r = parseRing(raw, { now });
    assert.equal(r.ok, false, raw);
    assert.equal(ringKey(r), null, raw);
  }
  assert.equal(parseRing('HU20-14530', { now }).needsClub, true);
});

test('anul pe două cifre: până la anul curent + 1 → 20AA, altfel 19AA', () => {
  assert.equal(parseRing('TW 27 123456', { now }).year, 2027);
  assert.equal(parseRing('RO-27-123456', { now }).year, 2027);
  assert.equal(parseRing('RO-28-123456', { now }).year, 1928);
  assert.equal(parseRing('RO-26-123456', { now }).year, 2026);
  assert.equal(parseRing('RO-98-123456', { now }).year, 1998);
  assert.equal(parseRing('HU-27-29-14530', { now }).year, 2027);
});

test('plasa de siguranță: un inel nerecunoscut are o cheie din textul curățat, care nu se confundă cu una recunoscută', () => {
  const a = parseRing('Latebred BasVK??', { now });
  assert.equal(a.ok, false);
  assert.equal(ringKey(a), null, 'cheia obișnuită rămâne goală');
  assert.equal(fallbackKey(a), '?|LATEBREDBASVK');
  assert.equal(storedRingKey(a), '?|LATEBREDBASVK');
  assert.equal(storedRingKey(parseRing('latebred  bas-vk', { now })), '?|LATEBREDBASVK', 'aceeași scriere, alți separatori');
  assert.equal(storedRingKey(parseRing('XYZ 12345 M', { now })), storedRingKey(parseRing('XYZ-12345', { now })), 'sexul nu intră în cheie');
  assert.equal(formatRing(a), 'Latebred BasVK??', 'se afișează cum a fost scris');
  // Inelele recunoscute își păstrează cheia; fără inel și maghiarul fără organizator n-au cheie de rezervă.
  assert.equal(storedRingKey(parseRing('RO-25-276971', { now })), 'RO|2025||276971');
  assert.equal(fallbackKey(parseRing('RO-25-276971', { now })), null);
  for (const raw of ['', '   ', '000 M', 'HU-23-14530', '??', '-']) assert.equal(storedRingKey(parseRing(raw, { now })), null, raw);
  assert.equal(fallbackKey(null), null);
});
