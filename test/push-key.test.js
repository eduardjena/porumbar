import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';

// Ajutorul din web/ e TypeScript fără importuri: îl rulăm direct, fără build Angular.
const src = stripTypeScriptTypes(fs.readFileSync(new URL('../web/src/app/core/push-key.ts', import.meta.url), 'utf8'));
const { keyBytes, sameKey } = await import('data:text/javascript;base64,' + Buffer.from(src).toString('base64'));

test('keyBytes: base64 url-safe, cu sau fără completare', () => {
  assert.deepEqual([...keyBytes('AQID')], [1, 2, 3]);
  assert.deepEqual([...keyBytes('-_8')], [251, 255]);
  assert.equal(keyBytes('').length, 0);
});

test('sameKey: aceeași cheie da; alta, mai scurtă sau lipsă nu', () => {
  const k = keyBytes('AQID');
  assert.equal(sameKey(new Uint8Array([1, 2, 3]).buffer, k), true);
  assert.equal(sameKey(new Uint8Array([1, 2, 4]).buffer, k), false);
  assert.equal(sameKey(new Uint8Array([1, 2]).buffer, k), false);
  assert.equal(sameKey(null, k), false);
  assert.equal(sameKey(undefined, k), false);
});
