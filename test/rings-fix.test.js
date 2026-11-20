import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRing, formatRing, ringKey, fallbackKey, storedRingKey } from '../src/rings.js';

/* Corecturile după review (feat/inele-lume): timp, caractere ascunse, ocolirea refuzului maghiar, sexul. */
const now = new Date('2026-11-16');
const k = (raw) => ringKey(parseRing(raw, { now }));

test('un text foarte lung se respinge repede (fără timp pătratic) și n-are nici cheie de rezervă', () => {
  const huge = {
    glued: 'AU' + 'A1'.repeat(500000),
    gluedEnd: 'A1'.repeat(500000) + ' AU',
    digitsSpaces: '1 '.repeat(500000) + 'AU',
    dashes: 'RO' + '-'.repeat(1000000) + '1',
    lettersDots: 'A.'.repeat(500000),
    dv: 'DV ' + '1 '.repeat(500000) + 'V',
  };
  for (const [name, text] of Object.entries(huge)) {
    const t = performance.now();
    const r = parseRing(text);
    const key = storedRingKey(r);
    const ms = performance.now() - t;
    assert.ok(ms < 50, `${name}: ${ms.toFixed(1)} ms`);
    assert.equal(r.ok, false, name);
    assert.equal(key, null, name);
  }
  const long = `RO-25-123456 ${'x'.repeat(120)}`;
  assert.equal(parseRing(long, { now }).ok, false);
  assert.equal(fallbackKey(parseRing(long, { now })), null);
});

test('caracterele ascunse și cifrele late nu strică inelul (textul scris rămâne neschimbat)', () => {
  for (const raw of ['RO-25-123­456', 'RO-25-12​3456', 'ＲＯ-25-１２３４５６', 'RO﻿-25-123456']) {
    const r = parseRing(raw, { now });
    assert.equal(r.ok, true, raw);
    assert.equal(ringKey(r), 'RO|2025||123456', raw);
    assert.equal(r.raw, raw);
  }
  assert.equal(parseRing('RO-25-١٢٣٤٥٦', { now }).ok, false, 'cifrele arabe nu sunt cifre de inel');
});

test('maghiarul fără organizator e refuzat și scris cu sexul în cuvinte sau cu HUNGARY', () => {
  for (const raw of ['HU-23-14530 tojó', 'HU 23 14530 FEMALE', 'HUNGARY 2023 14530', 'HU-23-14530 hím', 'HU 2023 14530 MALE']) {
    const r = parseRing(raw, { now });
    assert.equal(r.ok, false, raw);
    assert.equal(r.needsClub, true, raw);
    assert.equal(storedRingKey(r), null, raw);
  }
  const r = parseRing('HU-2023-29-14530 tojó', { now });
  assert.equal(r.ok, true);
  assert.equal(r.sex, 'F');
  assert.equal(parseRing('HUNGARY 2023 29 14530', { now }).country, 'HU');
  assert.equal(k('HUNGARY 2023 29 14530'), k('HU-2023-29-14530'));
});

test('cheia de rezervă nu ține seama de sexul scris în cuvinte', () => {
  const key = storedRingKey(parseRing('XYZ 123', { now }));
  assert.equal(key, '?|XYZ123');
  for (const raw of ['XYZ 123 HEN', 'XYZ 123 COCK', 'XYZ 123 tojó', 'XYZ 123 FEMALE', 'XYZ 123 M', 'XYZ 123 ♀']) {
    assert.equal(storedRingKey(parseRing(raw, { now })), key, raw);
  }
});

test('H după un inel englezesc / american / sud-african / australian = hen (femelă); la maghiari H = hím', () => {
  for (const raw of ['GB22T12345 H', 'GB 22 12345 H', 'NEHU2008X1234 H', 'IHU 09 S 76230 H', 'AU 18 RMR 18861 H', 'IF-1234-SCHOLAR-06 H',
    'CU 17 9307 H', 'ZA 2016 FB 1234 H', 'VRPU-23-10537 H', 'AUST 26 12345 H', 'NZ-2018-MF-79 H']) {
    const r = parseRing(raw, { now });
    assert.equal(r.ok, true, raw);
    assert.equal(r.sex, 'F', raw);
  }
  assert.equal(parseRing('HU-2023-29-14530 H', { now }).sex, 'M');
  assert.equal(parseRing('RO-26-800546 H', { now }).sex, 'M');
  assert.equal(parseRing('DV-08778-24-271 H', { now }).sex, 'M');
});

test('zerourile din față ale numărului se arată la familiile noi cu lățime fixă; cheia nu le ține', () => {
  assert.equal(formatRing(parseRing('CHN 26-15-0443185', { now })), 'CN-26-15-0443185');
  assert.equal(formatRing(parseRing('CHN2012-24-000001', { now })), 'CN-12-24-000001');
  assert.equal(formatRing(parseRing('HKPA 26-1384', { now })), 'HKPA-26-0001384');
  assert.equal(formatRing(parseRing('CRO-23-9273', { now })), 'HR-23-09273');
  assert.equal(k('CHN 26-15-0443185'), 'CN|2026|15|443185');
  assert.equal(k('CHN 26-15-443185'), k('CHN 26-15-0443185'));
  // Formele vechi rămân cum erau (FR, CN fără provincie), iar GB N / Z pierde zeroul, ca la RPRA.
  assert.equal(formatRing(parseRing('FR-21-006470', { now })), 'FR-21-6470');
  assert.equal(formatRing(parseRing('CHN-2019-0123456', { now })), 'CN-19-123456');
  assert.equal(formatRing(parseRing('GB17Z012345', { now })), 'GB-17-Z-12345');
});

test('Danemarca: clubul scris primul se citește în continuare, afișarea e cu anul primul (ca înainte)', () => {
  assert.equal(formatRing(parseRing('DAN 127-2003-0694', { now })), 'DK-03-127-694');
  assert.equal(k('DAN 127-2003-0694'), k('DAN 03-127-0694'));
  assert.equal(k('DK-26-46-205'), 'DK|2026|46|205');
});
