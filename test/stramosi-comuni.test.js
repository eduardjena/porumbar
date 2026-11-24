import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ringCompareKey, tmKeys } from '../web/src/app/shared/stramosi-comuni.ts';

// Aceeași fixtură ca la server (test/genealogy.test.js): regula T+M trebuie să dea aceleași rezultate.
const cazuri = JSON.parse(readFileSync(new URL('./fixtures/stramosi-comuni.json', import.meta.url), 'utf8'));
for (const c of cazuri) {
  test(`tmKeys (foaia): ${c.nume}`, () => {
    const poz = new Map(Object.entries(c.pozitii).map(([i, k]) => [Number(i), k]));
    assert.deepEqual([...tmKeys(poz)].sort(), [...c.tm].sort());
  });
}

test('același inel scris diferit are aceeași cheie', () => {
  const k = ringCompareKey('RO 26 123');
  assert.equal(k, 'RO26123');
  assert.equal(ringCompareKey('ro-26-123'), k);
  assert.equal(ringCompareKey('RO26/123'), k);
  assert.equal(ringCompareKey('R.O. 26 123'), k);
});
test('fără inel nu se compară', () => {
  assert.equal(ringCompareKey('  '), null);
  assert.equal(ringCompareKey(null), null);
  assert.equal(ringCompareKey(undefined), null);
  assert.equal(ringCompareKey('-/ .'), null);
});
