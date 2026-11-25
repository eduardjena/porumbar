import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseIds, idsOfGroups } from '../web/src/app/shared/fise-toate.ts';

test('parseIds', () => {
  assert.deepEqual(parseIds('3,1,3,x,-2,0, 7'), [3, 1, 7]);
  assert.deepEqual(parseIds(''), []);
  assert.deepEqual(parseIds(undefined), []);
  assert.equal(parseIds(Array.from({ length: 250 }, (_, i) => i + 1).join(',')).length, 200);
});
test('idsOfGroups', () => {
  assert.deepEqual(idsOfGroups([{ items: [{ id: 5 }, { id: 2 }] }, { items: [{ id: 9 }, { id: 5 }] }]), [5, 2, 9]);
  assert.deepEqual(idsOfGroups([]), []);
});
