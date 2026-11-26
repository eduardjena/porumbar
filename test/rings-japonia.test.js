import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatRing, japaneseRingText, parseRing } from '../src/rings.js';
import { previewRing } from '../web/src/app/shared/ring-preview.ts';

/*
 * Inelele japoneze scrise fără „JPN” (25-AB-01234): la conturile japoneze se recunosc ca inele JP. Funcția nu știe de
 * cont; cine salvează o cheamă doar la limba `ja`. Un inel doar din cifre rămâne cum l-a scris omul.
 */

test('forma japoneză (an + două litere + număr) primește „JPN ” în față, cu textul omului neschimbat', () => {
  assert.equal(japaneseRingText('25-AB-01234'), 'JPN 25-AB-01234');
  assert.equal(japaneseRingText('25AB01234'), 'JPN 25AB01234');
  assert.equal(japaneseRingText('2025 AB 01234'), 'JPN 2025 AB 01234');
  assert.equal(japaneseRingText('25-et-1234'), 'JPN 25-et-1234');
  assert.equal(japaneseRingText('２５ＡＢ０１２３４'), 'JPN ２５ＡＢ０１２３４');
  assert.equal(formatRing(parseRing(japaneseRingText('25AB01234'))), 'JP-25-AB-01234');
});

test('doar cifre, cu țară sau deja cu JPN: neschimbat (Review Focus 2)', () => {
  for (const s of ['26-800546', '25-12345', '2025-12345', '412084/15', 'JPN 25-AB-01234', 'RO 25 1234567']) assert.equal(japaneseRingText(s), s);
  for (const s of ['', '  ', 'AB-25-01234', '25-ABC-01234', '25-A-01234', '25-AB-1234567']) assert.equal(japaneseRingText(s), s);
});

test('parseRing nu se schimbă pentru inelul fără prefix (Review Focus 1)', () => {
  assert.equal(parseRing('25-AB-01234').ok, false);
  assert.equal(parseRing('25-AB-01234').raw, '25-AB-01234');
});

test('previzualizarea: la ja inelul japonez fără prefix, la ro ca azi', () => {
  assert.equal(previewRing('25-AB-01234', 'ja').display, 'JP-25-AB-01234');
  assert.equal(previewRing('25-AB-01234', 'ja').ok, true);
  assert.equal(previewRing('25-AB-01234', 'ro').ok, false);
  assert.equal(previewRing('25-AB-01234').ok, false);
  assert.deepEqual(previewRing('26-800546', 'ja'), previewRing('26-800546'));
  assert.deepEqual(previewRing('RO-26-800546 L', 'ja'), previewRing('RO-26-800546 L'));
});
