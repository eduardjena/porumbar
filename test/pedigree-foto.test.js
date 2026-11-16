import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { apiCaller } from './helpers/api.js';
import { startTestApp } from './helpers/db.js';
import { newAccount } from './helpers/accounts.js';
import { PEDIGREE_FOTO } from './fixtures/pedigree-foto.js';
import { loadPedigree } from './helpers/load-pedigree.js';

let server;
let base;
let a;
const call = apiCaller(() => ({ base }));
before(async () => {
  ({ server, base } = await startTestApp());
  a = await newAccount(call, 'A');
});
after(() => server?.close());

test('pedigree-ul foto, cap-coadă: repetări, consangvinizare, strămoși fără inel', async () => {
  const rootId = await loadPedigree(call, a, PEDIGREE_FOTO);
  const t = await call(`/api/pigeons/${rootId}/tree?generations=4`, { cookie: a });
  assert.equal(t.status, 200);
  const { tree, pigeons } = t.data;

  const places = new Map();
  const walk = (node) => {
    if (!node) return;
    const display = pigeons[node.id].ring?.display;
    if (!places.has(display)) places.set(display, []);
    places.get(display).push(node.repeat);
    walk(node.father);
    walk(node.mother);
  };
  walk(tree);

  const kras = places.get('NL-04-1954746');
  assert.equal(kras.length, 3);
  assert.ok(kras.every((g) => g !== null && g === kras[0]));
  for (const ring of ['RO-07-30937', 'RO-07-30962']) {
    assert.equal(places.get(ring).length, 2, ring);
    assert.notEqual(places.get(ring)[0], null, ring);
  }
  assert.equal(places.get('RO-15-412084')[0], null);

  // Cele două căsuțe fără inel sunt doi strămoși diferiți.
  assert.equal(places.get('000 M').length, 1);
  assert.equal(places.get('0000/07 RO M').length, 1);

  const coi = await call(`/api/pigeons/${rootId}/coi`, { cookie: a });
  assert.ok(coi.data.coi > 0);
  assert.ok(coi.data.common.some((c) => c.pigeon.ring.display === 'NL-04-1954746'));
});
