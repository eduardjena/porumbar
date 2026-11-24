import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tmIncape } from '../web/src/app/pages/retea/tm-incape.ts';

test('T+M incape pe felii late, nu pe cele inguste', () => {
  assert.equal(tmIncape(480, 11.25, 12), true);
  assert.equal(tmIncape(100, 5, 12), false);
});
