import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRing, formatRing } from '../src/rings.js';
import { previewRing } from '../web/src/app/shared/ring-preview.ts';
import { WORLD } from './fixtures/inele-lume.js';

/*
 * Previzualizarea din telefon (web/src/app/shared/ring-preview.ts) folosește chiar regulile serverului: pe tot tabelul
 * de exemple și pe formele vechi, ea spune același lucru ca parseRing / formatRing.
 */
const OLD = [
  'RO-26-800546 L', '412084/15 RO', '738256/09F', '6008107/08 BELG M', 'DV-8778-24-262', 'DV 17-01063-813 F',
  'AUS 18-301-1405 M', '159989 019-ESP', 'Ro 439175 - 2020', 'HU-2024-4-41013', 'HU24-04-41013♀', '000 M', '0000/07 RO M',
];
const ODD = ['Latebred BasVK??', 'SA-22-6338', 'RMR 25138', 'xyz', 'HU-23-14530', '14530/23 HU', '159989 019', ''];

test('previzualizarea spune același lucru ca serverul', () => {
  for (const text of [...WORLD.map(([raw]) => raw), ...OLD, ...ODD]) {
    const r = parseRing(text);
    const p = previewRing(text);
    assert.equal(p.ok, r.ok, text);
    assert.equal(p.unringed, r.unringed, text);
    assert.equal(p.sex, r.sex, text);
    assert.equal(p.display, r.ok && !r.unringed ? formatRing(r) : '', text);
    assert.equal(p.needsClub, Boolean(r.needsClub), text);
  }
});

test('previzualizarea: nerecunoscut (avertisment blând) față de maghiarul fără organizator (refuzat)', () => {
  assert.deepEqual(previewRing('Latebred BasVK??'), { ok: false, display: '', sex: null, unringed: false, needsClub: false, unknown: true });
  assert.equal(previewRing('HU-23-14530').needsClub, true);
  assert.equal(previewRing('HU-23-14530').unknown, false);
  assert.equal(previewRing('').unknown, false);
  assert.equal(previewRing('??').unknown, false, 'fără nicio literă sau cifră: nu e un inel (serverul îl refuză)');
  assert.equal(previewRing('??').ok, false);
  assert.equal(previewRing('GB22T12345').display, 'GB-22-T-12345');
  assert.equal(previewRing('HU-23-29-14530').display, 'HU-2023-29-14530');
});
